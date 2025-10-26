window.$ = document.querySelector.bind(document);

const settingsBtn = $('button[settings]');

settingsBtn.addEventListener('click', async () => {
    const settingsModal = $('#settingsModal');
    const overlayBackdrop = $('#overlayBackdrop');

    console.log(settingsBtn.dataset.open)

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
})

settingsBtn.click();