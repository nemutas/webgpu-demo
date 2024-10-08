export class SiteMap extends HTMLElement {
  static Define() {
    customElements.define('site-map', this)
  }

  connectedCallback() {
    if (!this.isConnected) return

    const anchors = this.querySelectorAll<HTMLAnchorElement>('a')
    for (const anchor of anchors) {
      anchor.href = `${import.meta.env.BASE_URL}pages/${anchor.innerText}/`
    }
  }

  disconnectedCallback() {}
}
