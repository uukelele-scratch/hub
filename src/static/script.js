import { encryptJSON, decryptJSON } from "./crypt.js";
// import marked from 'https://cdn.jsdelivr.net/npm/marked@16.4.1/+esm'
// import easymde from 'https://cdn.jsdelivr.net/npm/easymde/+esm';

window.$ = document.querySelector.bind(document);

function escapeHTML(str){
    return new Option(str).innerHTML;
}

function debounce(func, timeout = 500){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

const settingsBtn = $('.settings-btn');

settingsBtn.addEventListener('click', async () => {
    const settingsModal = $('.settings-modal');
    const overlayBackdrop = $('.overlay-backdrop');

    const isOpen = settingsBtn.dataset.open === 'true';
    if (isOpen) {
        settingsBtn.dataset.open = false;
        overlayBackdrop.classList.add('hidden');
        settingsModal.classList.add('hidden');
        settingsBtn.innerHTML = `<i data-lucide="settings">`
    } else {
        settingsBtn.dataset.open = true;
        overlayBackdrop.classList.remove('hidden');
        settingsModal.classList.remove('hidden');
        settingsBtn.innerHTML = `<i data-lucide="x">`
    }
    window.lucide?.createIcons();
});

const verifyValue = (val, el) => {
    if (val === null) { el.ariaInvalid = !Boolean(el.value); return; }
    const regex = val instanceof RegExp ? val : new RegExp(val);
    el.ariaInvalid = !regex.test(el.value);
};

$('#repo_url').addEventListener('input', e=>{
    verifyValue('/', e.target);
});

$('#gh_token').addEventListener('input', e=>{
    verifyValue('^(gh[pousr]_|github_pat_)[A-Za-z0-9_]+$', e.target);
})

$('#master_password').addEventListener('input', e=>{
    verifyValue(null, e.target);
})

document.addEventListener('hy:connected', async()=>{
    const settings = await portal.settings();

    if (!settings) {
        settingsBtn.click();
    }

    if (!window.localStorage.getItem('master_password')) {
        settingsBtn.click();
    }

    $('#repo_url').value = settings.repo_url;
    $('#master_password').value = atob(window.localStorage.getItem('master_password') || '');
    $('#gh_token').value = settings.github_token;

    verifyValue('/', $('#repo_url'));
    verifyValue('^(gh[pousr]_|github_pat_)[A-Za-z0-9_]+$', $('#gh_token'));
    verifyValue(null, $('#master_password'));

    const mde = new EasyMDE({
        element: $('#notes'),
        spellChecker: false,
        status: false,
    });
    window.mde = mde;

    mde.value("Loading notes...");


    const encryptedData = await portal.read('vault.enc');
    
    let data = null;
    if (encryptedData === '=9') {
        // brand new, first time setup
        data = {
            conversations: [],
            notes: [],
        }
        // await portal.write('vault.enc', await encryptJSON(data));
    } else {
        try {
            data = await decryptJSON(encryptedData);
        } catch (err) {
            mde.value("# DECRYPTION FAILED!\n\nCheck your master password in settings, then reload the page.");
            console.error("Decryption failed:", e);
            return;
        }
    }

    console.log(data);

    mde.value('Select a date to view notes.');

    window.selectedDate = null;

    function getSelectedNote() {
        if (!window.selectedDate) return null;
        const targetDateStr = window.selectedDate.toISOString().slice(0, 10);
        return data.notes.find(note => note.timestamp.slice(0, 10) === targetDateStr);
    }

    function getNotesByDate(date) {
        const targetDateStr = date.toISOString().slice(0, 10);
        return data.notes.filter(note => note.timestamp.slice(0, 10) === targetDateStr);
    }

    const saveVault = debounce(async () => {
        console.log("saving...");
        try {
            const encryptedData = await encryptJSON(data);
            await portal.write('vault.enc', encryptedData);
            calendar.render();
        } catch (e) {
            console.error(e)
        }
    })

    const calendar = new FullCalendar.Calendar($('#calendar'), {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
        },
        dayCellContent: arg => {
            const notes = getNotesByDate(arg.date);
            return { html: nunjucks.renderString(`
                {% for note in notes %}
                    <div class="note-summary" data-date="{{ arg.date.toISOString() }}">
                        {{ note.summary or 'Note' }}
                    </div>
                {% endfor %}    
            `, { notes, arg }) }
        },
        events: async (fetchInfo, successCallback, failureCallback) => {
            successCallback(data.notes.map(note => ({
                    id: note.id,
                    title: note.summary || 'Note',
                    start: note.timestamp,
                    allDay: true
                }))
            );
        },
        dateClick: async info => {
            window.selectedDate = info.date;
            const note = getSelectedNote();
            if (note)
                mde.value(note.content);
            else
                mde.value(`### Note for ${info.date.toISOString().slice(0,10)}\n\n`)
            mde.codemirror.focus();
        }
    });

    calendar.render();

    $('button[save]').addEventListener('click', e => {
        if (!window.selectedDate) return;

        e.target.ariaBusy = true;

        let note = getSelectedNote();
        const content = mde.value();

        if (!note) {
            note = {
                id: crypto.randomUUID(),
                content: content,
                timestamp: window.selectedDate.toISOString(),
                summary: null,
                tags: [],
            };
            data.notes.push(note);
        } else {
            note.content = content;
        }

        saveVault();

        e.target.ariaBusy = false;
    });

    mde.codemirror.on("change", () => {
        
    })
})

$('#settingsForm').addEventListener('submit', async e=>{
    e.preventDefault();

    e.submitter.ariaBusy = true;

    await portal.settings({
        repo_url: $('#repo_url').value,
        github_token: $('#gh_token').value,
    });
    window.localStorage.setItem('master_password', btoa($('#master_password').value));

    e.submitter.ariaBusy = false;
    settingsBtn.click();
})