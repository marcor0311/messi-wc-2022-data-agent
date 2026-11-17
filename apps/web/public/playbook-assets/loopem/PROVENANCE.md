# Loopem 0.1.0

Downloaded from the official npm package: https://registry.npmjs.org/loopem/-/loopem-0.1.0.tgz
Source: https://github.com/TahaSh/loopem
Documentation: https://loopem.tahazsh.com/docs/layouts/coverflow/
License: MIT, included in LICENSE. JavaScript files are unmodified package files.

Used in /playbook-coverflow.html and the desktop museum. The landing bundles the
unmodified modules through Next.js without another npm dependency.

The museum uses GSAP ScrollTrigger to pin one viewport while native document
scroll traverses the twenty-three chapters. Scroll position is the sole driver:
Loopem receives the offset through seek() with its built-in input disabled.
Vertical wheel events remain native. No document overflow lock, corrective
scroll loop, mandatory snap, or gesture-idle exit gate is installed.
ScrollTrigger computes the pin range during refresh, not during each wheel event.
ScrollToPlugin handles interruptible card/link navigation; keyboard chapter
selection and URL restoration commit immediately. Vertical keys remain native.
Drag and horizontal trackpad input update the same document scroll position.
GSAP context, tweens, event listeners and the picker are cleaned up on unmount
or when the accessible reading mode takes over.

The approved Cover Flow geometry is 108/84/86px, 56 degrees, reach 5, perspective
900px, scaled to the existing 62vw photograph width. Opacity remains 1 with
fixed ends. overscan: 1 bounds the live photograph layer to five images instead
of the previous ten near the middle of the gallery.

Captions share fixed grid tracks. Only changed year/goal digits animate; their
font metrics and clipping windows are measured and cached at setup/resize.
One GSAP ticker drives the photo follow, numeric transforms and text transitions.
After native scrollEnd, an interruptible 280ms ScrollTo tween centers the nearest
photo; fresh wheel input cancels it. Caption changes commit once the photo rests.
Changed digits roll vertically over 350ms. Title/summary exit over 120ms before
the next passage enters over 180ms; metadata crossfades over 180ms. Only metadata
uses additive blending. No title, summary, team or location slides horizontally.
The numeric layer is hidden from assistive technology; original chapter
semantics remain the accessible source. All chapters remain a complete vertical
server-rendered document without JavaScript, with reduced motion or enlarged text.

MuseumHero, MuseumGallery, MuseumChapter, MuseumReturn and MuseumPhoto render on
the server. getImageProps supplies optimized responsive image markup, and one
museum-level delegated error handler exposes image fallbacks. Only the small
MuseumExperience lifecycle boundary hydrates; the controller loads dynamically.

References: https://gsap.com/docs/v3/Plugins/ScrollTrigger/ and
https://nextjs.org/docs/app/api-reference/components/image#getimageprops.
Photo provenance remains in /memoria/seleccion/selection.json and /memoria/sources.json.
The standalone playbook prototype retains its separate autoplay/gesture demo.
