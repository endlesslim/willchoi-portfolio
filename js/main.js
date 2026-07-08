document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.nav');
  if (nav && 'IntersectionObserver' in window) {
    // sentinel just below the top of the page; nav gets its border once it scrolls away
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;top:8px;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.prepend(sentinel);
    new IntersectionObserver(([entry]) => {
      nav.classList.toggle('scrolled', !entry.isIntersecting);
    }).observe(sentinel);
  }

  const revealEls = document.querySelectorAll('.reveal');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (revealEls.length && 'IntersectionObserver' in window && !prefersReduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
    revealEls.forEach((el) => io.observe(el));
    // safety net: if an element never intersects (e.g. odd layout), reveal it anyway
    setTimeout(() => revealEls.forEach((el) => el.classList.add('in')), 2500);
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }
});
