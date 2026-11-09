// Personen im Haushalt: „Wer bist du?“-Dialog beim ersten Start und der Bereich in „Mehr“.
import { store } from '../store.js';
import { icon } from '../icons.js';
import { esc, openDialog, toast, confirmDialog } from '../ui.js';
import {
  members, me, setMe, addMember, updateMember, removeMember, avatar, MEMBER_TONES, MAX_NAME, skipWho, currentUser, suggestedName,
} from '../members.js';
import { signOut } from '../firebase.js';

export function whoAmIDialog() {
  const list = members().filter((m) => !m.uid);
  let chosen = false;
  openDialog({
    title: 'Wie heißt du in der App?',
    body: `
      <p class="muted small">Dann seht ihr, wer ein Rezept angelegt, etwas eingeplant, eine Notiz geschrieben oder im Laden abgehakt hat. Der Name gilt nur in dieser App – dein Google-Konto bleibt unverändert.</p>
      ${list.length ? `<p class="small"><b>Bist du schon eingetragen?</b></p><div class="who-list">${list.map((m) => `<button type="button" class="who-pick" data-pick="${m.id}">${avatar(m)}<b>${esc(m.name)}</b></button>`).join('')}</div>` : ''}
      <form class="inline-form" data-new-me>
        <input id="whoName" maxlength="${MAX_NAME}" value="${list.length ? '' : esc(suggestedName())}" placeholder="Dein Name, z. B. Alex" autocomplete="given-name" aria-label="Anzeigename">
        <button class="btn primary" type="submit">Das bin ich</button>
      </form>
      <div class="sheet-actions"><button type="button" class="btn ghost" data-close>Später</button></div>`,
    mount(dlg, close) {
      if (!list.length) dlg.querySelector('#whoName').focus();
      dlg.querySelector('[data-new-me]').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = dlg.querySelector('#whoName').value.trim();
        if (!name) return;
        chosen = true;
        addMember(name, true);
        toast(`Hallo ${name}!`);
        close();
      });
      dlg.addEventListener('click', (e) => {
        const p = e.target.closest('[data-pick]');
        if (!p) return;
        chosen = true;
        setMe(p.dataset.pick);
        close();
      });
      dlg.addEventListener('close', () => { if (!chosen) skipWho(); });
    },
  });
}

export function peopleSection() {
  const self = me();
  const list = members();
  return `
    <section class="card settings" id="personen">
      <div class="card-head"><h2>${icon('users')} Personen</h2><span class="muted small">Anzeigenamen</span></div>
      <div class="field"><span>Angemeldet mit Google</span>
        <div class="account-row"><b class="account-mail">${esc(currentUser()?.email || '–')}</b>
          ${self ? '' : '<button type="button" class="btn small" data-who>Anzeigenamen wählen</button>'}
          <button type="button" class="btn small ghost" data-signout>${icon('logout')} Abmelden</button></div>
      </div>
      ${list.length ? `
        <div class="field"><span>Anzeigenamen <em>so heißt ihr in der App – Farbe antippen zum Wechseln</em></span>
          <ul class="edit-list people-list">${list.map((m) => `<li>
            <button type="button" class="avatar-btn" data-member-tone="${m.id}" aria-label="Farbe von ${esc(m.name)} wechseln">${avatar(m)}</button>
            <input value="${esc(m.name)}" maxlength="${MAX_NAME}" data-member-name="${m.id}" aria-label="Anzeigename">
            ${self?.id === m.id ? '<span class="badge accent">Du</span>' : m.uid ? '' : '<span class="badge" title="Noch mit keinem Google-Konto verbunden">ohne Konto</span>'}
            <button type="button" class="icon-btn danger" data-member-del="${m.id}" aria-label="${esc(m.name)} entfernen">${icon('trash')}</button></li>`).join('')}</ul>
        </div>` : '<p class="muted small">Noch niemand eingetragen.</p>'}
      <label class="field"><span>Name der App</span><input id="hhName" value="${esc(store.settings().householdName)}" placeholder="Unsere Küche"></label>
      <p class="muted small">Wer sich mit einem freigeschalteten Google-Konto anmeldet, wählt beim ersten Mal einen Anzeigenamen und erscheint dann hier. Welche Konten Zugriff haben, steht in den Sicherheitsregeln des Firebase-Projekts.</p>
    </section>`;
}

export function mountPeople(root) {
  root.querySelector('#hhName')?.addEventListener('change', (e) => store.setSettings({ householdName: e.target.value.trim() || 'Unsere Küche' }));
  root.querySelectorAll('[data-member-name]').forEach((inp) => inp.addEventListener('change', () => {
    const name = inp.value.trim();
    if (name) { updateMember(inp.dataset.memberName, { name }); toast('Anzeigename gespeichert'); }
  }));
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-who]')) whoAmIDialog();
    if (e.target.closest('[data-signout]')) {
      const ok = await confirmDialog({ title: 'Abmelden?', text: 'Auf diesem Gerät werden die zwischengespeicherten Daten entfernt. In der gemeinsamen Datenbank bleibt alles erhalten.', confirm: 'Abmelden' });
      if (ok) { await signOut(); location.reload(); }
    }
    const tone = e.target.closest('[data-member-tone]');
    if (tone) {
      const m = members().find((x) => x.id === tone.dataset.memberTone);
      updateMember(m.id, { tone: MEMBER_TONES[(MEMBER_TONES.indexOf(m.tone) + 1) % MEMBER_TONES.length] });
    }
    const del = e.target.closest('[data-member-del]');
    if (del) {
      const m = members().find((x) => x.id === del.dataset.memberDel);
      const text = m.id === me()?.id ? 'Das bist du. Beim nächsten Öffnen fragt die App wieder nach deinem Anzeigenamen. Bisherige Einträge zeigen dann keinen Namen mehr.' : 'Bisherige Einträge bleiben erhalten, zeigen aber keinen Namen mehr. Das Google-Konto behält seinen Zugriff.';
      if (await confirmDialog({ title: `${m.name} entfernen?`, text, confirm: 'Entfernen' })) removeMember(m.id);
    }
  });
}
