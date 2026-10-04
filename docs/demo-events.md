# Demo RSVP candidates (open, free, Luma, SF, chosen 4.10 09:35 from data/seed-events.json)

Profile for the demo: "in SF 5–11 Oct, I build video AI agents, no crypto". Base: SoMa, 511 Harrison.

| When (PT) | Event | URL | Venue | going |
|---|---|---|---|---|
| Tue 6 Oct 12:00 | Coding Agents Mini Conference: booths, live demos | https://luma.com/z9y63bn8 | Sports Basement Stonestown | 55 |
| Tue 6 Oct 12:00 | DevTools Drink Up // Depot x Inference | https://luma.com/i3y4poqn | 8 California St | 0 |
| Tue 6 Oct 17:30 | Shipping Agents you can Trust | https://luma.com/smodxivh | Creative Landing Spaces | 13 |
| Tue 6 Oct 18:30 | Practical AI for Documentation | https://luma.com/mngid6og | Mindspace Coworking | 129 |
| Mon 5 Oct 18:00 | Automate Your SF Tech Week with n8n | https://luma.com/n8n-ntlt | Digital Jungle SF | 0 |

Rules: never pay, never solve captchas, approval-required → `pending`. Dry-run the selectors at ~12:30
before the live demo. Name on forms: Rustam Salavatov; email: rust-6252@agentmail.to.

## Luma anonymous RSVP flow (probed 09:40 on luma.com/smodxivh, not submitted)

1. Page loads with a `button` whose text is `Register` (class `lux-button … primary`).
2. Click → inline form (no dialog): `input[name="name"]` (placeholder "Your Name"), `input[name="email"]`
   (placeholder "you@email.com"), then the same `Register` button submits.
3. After submit Luma likely asks for a one-time code sent to the email (UNVERIFIED): the agent must read
   the newest AgentMail message, extract the 6-digit code, and type it. Treat captcha as `needs_human`.
4. Success signs: `?tk=` in URL / "You're in" text / Add to Calendar button. Never trust the "Going" count.
