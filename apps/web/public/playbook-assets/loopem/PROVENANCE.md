# Loopem 0.1.0

Downloaded from the official npm package: https://registry.npmjs.org/loopem/-/loopem-0.1.0.tgz
Source: https://github.com/TahaSh/loopem
Documentation: https://loopem.tahazsh.com/docs/layouts/coverflow/
License: MIT, included in LICENSE. JavaScript files are unmodified package files.

Used in the approved desktop proposal at /playbook-coverflow.html and in the
landing gallery. The landing bundles these unmodified modules through Next.js;
no new npm dependency is required. The landing uses clamp mode (fixed ends)
and has no timeline. Its original narrative remains the server-rendered,
reduced-motion and enlarged-text fallback.
The proposal uses the demo's Cover Flow geometry (108/84/86px, 56 degrees,
reach 5, perspective 900px), scaled proportionally to the existing photo width.
It keeps opacity at 1 and disables fading so photos never dissolve through each
other. Loopem handles drag, flick, side-card selection and horizontal wheel
input in wrap mode, using the demo's stiffness 13 and friction 0.026.
GSAP drives interruptible button/timeline navigation through the public seek API.
Vertical mouse-wheel input uses that same offset and snaps at gesture end.
Application-managed playback wraps and pauses on hover or hidden documents;
it stays off when reduced motion is requested.
Photos and captions are reused from the existing main page; original provenance remains
in /memoria/seleccion/selection.json and /memoria/sources.json.
