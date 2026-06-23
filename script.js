/* ===== NAVBAR ===== */
const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

/* ===== SMOOTH SCROLL (fallback for older browsers) ===== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
  });
});

/* ===== SCROLL FADE & SKILL BAR ANIMATION ===== */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    observer.unobserve(entry.target);
  });
}, { threshold: 0.15 });

document.querySelectorAll('[data-fade]').forEach((el, i) => {
  el.style.transitionDelay = `${i * 0.08}s`;
  observer.observe(el);
});

document.querySelectorAll('.skill-card').forEach((card, i) => {
  card.setAttribute('data-fade', '');
  card.style.transitionDelay = `${i * 0.08}s`;
  observer.observe(card);
});

/* ===== CONTACT FORM ===== */
// バックエンド(SESメーラー)のエンドポイント。nginxで /api をNodeに転送する想定。
const CONTACT_ENDPOINT = '/api/contact';

const form = document.getElementById('contactForm');
form.addEventListener('submit', async e => {
  e.preventDefault();

  const btn = form.querySelector('button[type="submit"]');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

  const showMessage = (text, color) => {
    let msg = form.querySelector('.form-result');
    if (!msg) {
      msg = document.createElement('p');
      msg.className = 'form-result';
      msg.style.cssText = 'text-align:center;margin-top:16px;font-size:0.9rem;';
      form.appendChild(msg);
    }
    msg.style.color = color;
    msg.textContent = text;
    return msg;
  };

  try {
    const data = Object.fromEntries(new FormData(form).entries());

    const res = await fetch(CONTACT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.ok) {
      throw new Error(result.error || '送信に失敗しました。');
    }

    btn.innerHTML = '<i class="fas fa-circle-check"></i> 送信完了！';
    btn.style.background = 'linear-gradient(135deg, #00d4aa, #0099cc)';
    const msg = showMessage(
      'お問い合わせありがとうございます。2営業日以内にご返信いたします。',
      '#00d4aa'
    );
    form.reset();

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = orig;
      btn.style.background = '';
      msg.remove();
    }, 5000);
  } catch (err) {
    showMessage(err.message || '送信に失敗しました。時間をおいて再度お試しください。', '#ff6b6b');
    btn.disabled = false;
    btn.innerHTML = orig;
  }
});

/* ===== ACTIVE NAV HIGHLIGHT ON SCROLL ===== */
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-links a[href^="#"]');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const id = entry.target.getAttribute('id');
    navItems.forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
    });
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => sectionObserver.observe(s));
