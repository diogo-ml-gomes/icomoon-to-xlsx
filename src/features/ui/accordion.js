/**
 * @param {HTMLElement | null} accordion
 * @param {boolean} expanded
 */
export function setAccordionExpanded(accordion, expanded) {
  if (!accordion) return;

  accordion.classList.toggle("is-collapsed", !expanded);
  const toggle = accordion.querySelector(".mobile-accordion-toggle");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(expanded));
  }
}

/**
 * @param {HTMLElement | null} accordion
 */
export function toggleAccordion(accordion) {
  if (!accordion) return;
  setAccordionExpanded(accordion, accordion.classList.contains("is-collapsed"));
}
