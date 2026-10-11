// DOM HUD: health with damage trail, stamina, signature pips, round dots, clock, call-outs.

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = $('hud');
    this.callout = $('callout');
    this.countEl = $('count');
    this.banner = $('banner');
    this._calloutT = null;
    this._bannerT = null;
  }

  setNames(p1, p2) {
    $('n1').textContent = `${p1.firstName} “${p1.nickname}”`.toUpperCase();
    $('n2').textContent = `${p2.firstName} “${p2.nickname}”`.toUpperCase();
  }

  show(on) {
    this.el.classList.toggle('hidden', !on);
  }

  side(i, f) {
    const hp = Math.max(0, f.hp);
    $('hp' + i).style.width = hp + '%';
    $('tr' + i).style.width = Math.max(hp, f.shownHp) + '%';
    $('hp' + i + 't').textContent = Math.ceil(hp);
    $('hp' + i).parentElement.classList.toggle('low', hp < 20);
    const st = $('st' + i);
    st.style.width = f.stamina + '%';
    st.parentElement.classList.toggle('tired', f.tired);
    const pips = $('pip' + i);
    const n = Math.floor(f.sig + 1e-6);
    // the blue corner's pips fill from the outer edge, like the health bar
    [...pips.children].forEach((p, k) => p.classList.toggle('on', i === 1 ? k < n : 2 - k < n));
    pips.classList.toggle('full', n >= 3);
  }

  dots(i, won) {
    [...$('dots' + i).children].forEach((d, k) => d.classList.toggle('on', i === 1 ? k < won : 1 - k < won));
  }

  clock(round, secs) {
    $('round-l').textContent = `ROUND ${round}`;
    const s = Math.max(0, Math.ceil(secs));
    $('clock-t').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  say(big, tag = '', ms = 1100) {
    this.callout.querySelector('.big').textContent = big;
    this.callout.querySelector('.tag').textContent = tag;
    this.callout.classList.add('show');
    clearTimeout(this._calloutT);
    this._calloutT = setTimeout(() => this.callout.classList.remove('show'), ms);
  }

  count(n, hint) {
    if (n === null) {
      this.countEl.style.display = 'none';
      return;
    }
    this.countEl.style.display = 'block';
    this.countEl.innerHTML = `${n}${hint ? `<small>${hint}</small>` : ''}`;
  }

  flash(text, sub = '', ms = 1400) {
    this.banner.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    this.banner.style.display = 'block';
    clearTimeout(this._bannerT);
    if (ms) this._bannerT = setTimeout(() => (this.banner.style.display = 'none'), ms);
  }

  hideFlash() {
    clearTimeout(this._bannerT);
    this.banner.style.display = 'none';
  }
}
