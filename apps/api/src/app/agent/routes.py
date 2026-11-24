import json
import os
import sqlite3
import threading
import time
from functools import lru_cache
from typing import Literal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, ConfigDict
from app.agent.auth import Auth, COOKIE
from app.agent.analytics import Analytics, Query, VIEWS
from app.agent.runtime import DataAgent, model_catalog
from app.db.gold import ROOT

router=APIRouter()
lock=threading.Lock()
auth_lock=threading.Lock()

@lru_cache
def _auth(): return Auth()

def auth():
    with auth_lock:
        return _auth()
@lru_cache
def analytics(): return Analytics()

@lru_cache
def data_agent():
    # One compiled graph and one set of instructions per process.
    return DataAgent(analytics())

def identity(request: Request): return auth().account(request.cookies.get(COOKIE))

def safe_origin(request: Request):
    origin=request.headers.get('origin')
    if origin and origin not in (os.environ.get('AGENT_WEB_ORIGIN','http://127.0.0.1:3000'),'http://127.0.0.1:8000'):
        raise HTTPException(403,'Origen no permitido')

@router.get('/api/auth/start')
def start(account_id: str|None=None):
    url,state=auth().start(account_id)
    response=RedirectResponse(url)
    response.set_cookie('football_oauth',state,httponly=True,samesite='lax',max_age=600)
    return response

@router.get('/auth/callback')
def callback(request: Request, state: str='', code: str|None=None, client_id: str|None=None,error: str|None=None):
    session=auth().callback(state,request.cookies.get('football_oauth'),code,client_id,error)
    response=RedirectResponse(os.environ.get('AGENT_WEB_ORIGIN','http://127.0.0.1:3000')+'/agent',status_code=303)
    response.set_cookie(COOKIE,session,httponly=True,samesite='lax',max_age=30*86400)
    response.delete_cookie('football_oauth')
    return response

@router.get('/api/auth/status')
def status(request: Request):
    try:
        key,account=identity(request)
        return {'authenticated':True,'account_id':key,'email':account['email']}
    except HTTPException as exc:
        return {'authenticated':False,'detail':exc.detail}

@router.get('/api/auth/accounts')
def accounts():
    return [{'account_id':k,'label':v['email']+' ('+v['client_id'][-8:]+')'} for k,v in auth().state['accounts'].items()]

@router.post('/api/auth/logout',dependencies=[Depends(safe_origin)])
def logout(request: Request):
    from fastapi.responses import JSONResponse
    response=JSONResponse(auth().logout(request.cookies.get(COOKIE))); response.delete_cookie(COOKIE)
    return response

@router.get('/api/agent/catalog')
def catalog(a=Depends(analytics)):
    return {'datasets':a.describe(), 'entities':a.entities(), 'metrics':a.metrics, 'views':VIEWS,
            'load_id':a.catalog['load_id'],'limitations':a.catalog['limitations']}

@router.get('/api/agent/models')
def models(user=Depends(identity)):
    choices=model_catalog(user[1])
    return {'models':choices,'selected':choices[0]['slug'],'selection':'First model in the official account catalog ordering; selectable per question.'}

@router.post('/api/agent/query',dependencies=[Depends(safe_origin)])
def query(q: Query,a=Depends(analytics)):
    # Public deterministic explorer, clearly separate from authenticated inference.
    try: return a.query(q)
    except ValueError as exc: raise HTTPException(422,str(exc)) from exc

class Chat(BaseModel):
    model_config=ConfigDict(extra='forbid')
    question: str=Field(min_length=1,max_length=4000)
    conversation_id: str|None=Field(default=None,max_length=50)
    model: str|None=None
    audience: Literal['simple','fan','analyst']='analyst'  # kept for old clients; every answer is written for analysts

def db():
    con=sqlite3.connect(ROOT/'data/agent/chats.sqlite3')
    con.execute('CREATE TABLE IF NOT EXISTS turns (id TEXT PRIMARY KEY, owner TEXT, created REAL, payload TEXT)')
    return con

@router.get('/api/agent/conversations/{conversation_id}')
def history(conversation_id: str,user=Depends(identity)):
    with db() as con: row=con.execute('SELECT payload FROM turns WHERE id=? AND owner=?',(conversation_id,user[0])).fetchone()
    if not row: raise HTTPException(404,'Conversación no encontrada')
    return {'conversation_id':conversation_id,'turns':json.loads(row[0])}

@router.post('/api/agent/chat',dependencies=[Depends(safe_origin)])
def chat(body: Chat,user=Depends(identity),a=Depends(analytics)):
    if not lock.acquire(blocking=False): raise HTTPException(409,'Ya hay una consulta en curso; espera a que termine.')
    try:
        choices=model_catalog(user[1]); selected=body.model or choices[0]['slug']
        if selected not in [m['slug'] for m in choices]: raise HTTPException(422,'Modelo no disponible para esta cuenta')
        previous=[]; cid=body.conversation_id or str(uuid4())
        if body.conversation_id: previous=history(cid,user)['turns']
        if len(previous)>=100: raise HTTPException(422,'Inicia una conversación nueva para continuar.')
        result=data_agent().answer(user[1],body.question,previous,selected,'analyst')
        with db() as con:
            con.execute('INSERT OR REPLACE INTO turns VALUES (?,?,?,?)',(cid,user[0],time.time(),json.dumps([*previous,result])))
        return {'conversation_id':cid,'turn':result}
    finally: lock.release()
