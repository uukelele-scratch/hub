import { encryptJSON, decryptJSON } from "./crypt.js";
// import marked from 'https://cdn.jsdelivr.net/npm/marked@16.4.1/+esm'
// import easymde from 'https://cdn.jsdelivr.net/npm/easymde/+esm';

window.$ = document.querySelector.bind(document);

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
        await portal.write('vault.enc', await encryptJSON(data));
    } else {
        data = await decryptJSON(encryptedData);
    }

    console.log(data);

    mde.value(data.notes[0] || 'No notes found.');
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