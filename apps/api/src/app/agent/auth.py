"""Official SIWC public-client OAuth, owner-only local credentials."""
import base64
import hashlib
import json
import os
import secrets
import threading
import time
from pathlib import Path
from urllib.parse import urlencode
from uuid import uuid4

import httpx
import jwt
from fastapi import HTTPException
from app.db.gold import ROOT

ISSUER = 'https://auth.openai.com'
RESOURCE = 'https://api.openai.com/v1'
AUTHORIZE = ISSUER + '/api/accounts/authorize'
TOKEN = ISSUER + '/api/accounts/oauth/token'
SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
CALLBACK = os.environ.get('AGENT_CALLBACK', 'http://127.0.0.1:8000/auth/callback')
if not CALLBACK.startswith('http://127.0.0.1:') or not CALLBACK.endswith('/auth/callback'):
    raise ValueError('AGENT_CALLBACK must be an HTTP loopback /auth/callback URI')
COOKIE = 'football_session'
ROOT_ENV = ROOT / '.env'
AUTH_STATE_KEY = 'AGENT_AUTH_STATE_B64'


def _read_env_state(path):
    if not path.exists(): return None
    for line in path.read_text().splitlines():
        key, sep, value = line.partition('=')
        if sep and key.strip() == AUTH_STATE_KEY:
            try: return json.loads(base64.urlsafe_b64decode(value.strip().encode()).decode())
            except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise RuntimeError('AGENT_AUTH_STATE_B64 in root .env is invalid') from exc
    return None


def _write_env_state(path, state):
    encoded = base64.urlsafe_b64encode(json.dumps(state, separators=(',', ':')).encode()).decode()
    lines = path.read_text().splitlines() if path.exists() else []
    replacement = AUTH_STATE_KEY + '=' + encoded
    found = False
    output = []
    for line in lines:
        if line.partition('=')[0].strip() == AUTH_STATE_KEY:
            if not found: output.append(replacement)
            found = True
        else: output.append(line)
    if not found: output.append(replacement)
    temporary = path.with_name(path.name + '.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f: f.write('\n'.join(output) + '\n')
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)


def fingerprint(value):
    return hashlib.sha256(value.encode()).hexdigest()

class Auth:
    def __init__(self, path=None):
        self.file_path = Path(path) if path else None
        self.path = self.file_path or ROOT_ENV
        self.lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        if self.file_path:
            self.state = json.loads(self.path.read_text()) if self.path.exists() else None
        else:
            self.state = _read_env_state(self.path)
            legacy = ROOT / 'data/agent/credentials.json'
            legacy_to_remove = None
            if self.state is None and legacy.exists():
                self.state = json.loads(legacy.read_text())
                legacy_to_remove = legacy
        if self.state is None:
            self.state = {'host_id': 'urn:uuid:' + str(uuid4()), 'accounts': {}, 'sessions': {}, 'pending': {}}
        self.save()
        if not self.file_path and legacy_to_remove:
            legacy_to_remove.unlink()

    def save(self):
        if not self.file_path:
            _write_env_state(self.path, self.state)
            return
        temporary = self.path.with_name(self.path.name + '.tmp')
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as f: json.dump(self.state, f)
        os.chmod(temporary, 0o600)
        os.replace(temporary, self.path)

    def start(self, account_id=None):
        with self.lock:
            account = self.state['accounts'].get(account_id) if account_id else None
            if account_id and not account: raise HTTPException(400, 'Cuenta desconocida')
            state, nonce, verifier = (secrets.token_urlsafe(40) for _ in range(3))
            client_id = account['client_id'] if account else 'dynamic_agent_client'
            self.state['pending'] = {k:v for k,v in self.state['pending'].items() if v['expires'] > time.time()}
            self.state['pending'][state] = {'nonce':nonce,'verifier':verifier,'client_id':client_id,
                                          'account_id':account_id, 'expires':time.time()+600}
            self.save()
            params = dict(client_id=client_id,ext_agent_host_id=self.state['host_id'],response_type='code',
                          redirect_uri=CALLBACK,scope=SCOPES,resource=RESOURCE,state=state,nonce=nonce,
                          code_challenge_method='S256',code_challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('='))
            if account:
                if account.get('id_token'): params['id_token_hint']=account['id_token']
                if account.get('email'): params['login_hint']=account['email']
            else: params['agent_name_hint']='Football Gold Data Agent'
            return AUTHORIZE + '?' + urlencode(params), state

    def validate_id(self, token, client_id, nonce):
        with httpx.Client(timeout=20) as client:
            discovery=client.get(ISSUER+'/.well-known/openid-configuration'); discovery.raise_for_status()
            uri=discovery.json()['jwks_uri']
            if not uri.startswith(ISSUER+'/'): raise ValueError('JWKS origin inválido')
            keys=client.get(uri); keys.raise_for_status()
        header=jwt.get_unverified_header(token)
        key=next((jwt.PyJWK(k) for k in keys.json()['keys'] if k.get('kid')==header.get('kid')),None)
        if not key: raise ValueError('Firma de identidad desconocida')
        claims=jwt.decode(token,key.key,algorithms=['RS256'],audience=client_id,issuer=ISSUER,
                          options={'require':['exp','iat','sub','aud','iss','nonce']})
        if not secrets.compare_digest(claims['nonce'],nonce): raise ValueError('Nonce inválido')
        return claims

    def callback(self, state, browser_state, code=None, client_id=None, error=None):
        with self.lock:
            if not state or not browser_state or not secrets.compare_digest(state,browser_state):
                raise HTTPException(400,'Estado OAuth inválido')
            pending=self.state['pending'].pop(state,None); self.save()
            if not pending or pending['expires'] < time.time(): raise HTTPException(400,'Autorización expirada')
            if error: raise HTTPException(400,'Autorización rechazada: '+error[:80])
            issued=pending['client_id']
            if issued=='dynamic_agent_client':
                if not client_id or client_id=='dynamic_agent_client': raise HTTPException(400,'Registro incompleto: falta client_id emitido')
                issued=client_id
            elif client_id and client_id!=issued: raise HTTPException(400,'Registro de cuenta incompatible')
            if not code: raise HTTPException(400,'Falta el código de autorización')
            try:
                with httpx.Client(timeout=30) as client:
                    response=client.post(TOKEN,data=dict(grant_type='authorization_code',client_id=issued,
                        code=code,code_verifier=pending['verifier'],redirect_uri=CALLBACK,resource=RESOURCE))
                    response.raise_for_status(); tokens=response.json()
                claims=self.validate_id(tokens['id_token'],issued,pending['nonce'])
                if 'chatgpt.tokens.use.direct' not in tokens.get('scope','').split():
                    raise ValueError('No se concedió permiso de uso del plan ChatGPT')
                previous=self.state['accounts'].get(pending['account_id'])
                if previous and claims['sub']!=previous['subject']: raise ValueError('Identidad incompatible con la cuenta seleccionada')
                key=fingerprint(issued+'|'+claims['sub'])
                self.state['accounts'][key]={**tokens,'client_id':issued,'subject':claims['sub'],
                                            'email':claims.get('email','Cuenta ChatGPT'),'expires_at':time.time()+tokens['expires_in']}
                session=secrets.token_urlsafe(48)
                self.state['sessions'][fingerprint(session)]={'account_id':key,'expires':time.time()+30*86400}
                self.save()
                return session
            except (httpx.HTTPError,ValueError,KeyError,jwt.PyJWTError) as exc:
                raise HTTPException(401,'No se pudo verificar la autorización oficial. Inicia sesión de nuevo.') from exc

    def account(self, session):
        with self.lock:
            record=self.state['sessions'].get(fingerprint(session or ''))
            if not record or record['expires']<time.time(): raise HTTPException(401,'Continúa con ChatGPT para consultar al agente.')
            key=record['account_id']; account=self.state['accounts'][key]
            if not account.get('access_token'): raise HTTPException(401,'Sesión cerrada')
            if account['expires_at']<time.time()+60:
                try:
                    with httpx.Client(timeout=30) as client:
                        r=client.post(TOKEN,data=dict(grant_type='refresh_token',client_id=account['client_id'],
                                                     refresh_token=account['refresh_token'],resource=RESOURCE))
                        r.raise_for_status(); replacement=r.json()
                    updated={**account,**replacement,'expires_at':time.time()+replacement['expires_in']}
                    if 'chatgpt.tokens.use.direct' not in updated.get('scope','').split(): raise ValueError('Permiso revocado')
                    self.state['accounts'][key]=updated; self.save(); account=updated
                except (httpx.HTTPError,ValueError,KeyError) as exc:
                    raise HTTPException(401,'La sesión expiró o fue revocada. Continúa de nuevo con ChatGPT.') from exc
            return key,dict(account)

    def logout(self, session):
        with self.lock:
            record=self.state['sessions'].pop(fingerprint(session or ''),None)
            confirmed=True
            if record:
                key=record['account_id']; account=self.state['accounts'][key]
                if account.get('refresh_token'):
                    confirmed=False
                    for _ in range(2):
                        try:
                            with httpx.Client(timeout=15) as client:
                                d=client.get(ISSUER+'/.well-known/openid-configuration'); d.raise_for_status()
                                uri=d.json()['revocation_endpoint']
                                if not uri.startswith(ISSUER+'/'): raise ValueError('Revocation origin inválido')
                                r=client.post(uri,data={'token':account['refresh_token'],'token_type_hint':'refresh_token','client_id':account['client_id']})
                                confirmed=r.status_code==200
                            if confirmed: break
                        except (httpx.HTTPError,ValueError,KeyError): pass
                self.state['accounts'][key]={k:v for k,v in account.items() if k in ('client_id','subject','email')}
                self.state['sessions']={k:v for k,v in self.state['sessions'].items() if v['account_id']!=key}
            self.save()
            return {'remote_revocation_confirmed':confirmed, 'message':'Sesión cerrada' if confirmed else 'Sesión local cerrada. Revocación remota sin confirmar; desconecta la app en ChatGPT Settings.'}
