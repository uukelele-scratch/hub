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
    if (val === null) { el.ariaInvalid = !Boolean(el.value); if (el.ariaInvalid==="false"){el.ariaInvalid=null} return; }
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
    window.settings = await portal.settings();

    if (!settings) {
        settingsBtn.click();
    }

    $('#repo_url').value = settings.REPO_URL;
    $('#master_password').value = atob(window.masterPassword || '');
    $('#gh_token').value = settings.GITHUB_TOKEN;

    verifyValue('/', $('#repo_url'));
    verifyValue('^(gh[pousr]_|github_pat_)[A-Za-z0-9_]+$', $('#gh_token'));
    verifyValue(null, $('#master_password'));

    if (!window.masterPassword) {
        settingsBtn.click();
        /* wait until saved ?? */
        await new Promise((resolve, reject) => {
            window.continuePassword = resolve;
        });
    }

    const mde = new EasyMDE({
        element: $('#notes'),
        spellChecker: false,
        status: false,
    });
    window.mde = mde;

    mde.value("Loading notes...");


    const encryptedData = await portal.read('vault.enc');
    
    window.data = null;
    if (!encryptedData) {
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
            console.error("Decryption failed:", err);
            return;
        }
    }

    // console.log(data);

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

    const saveVaultAsync = async () => {
        console.log('saving...');
        try {
            const encryptedData = await encryptJSON(data);
            await portal.write('vault.enc', encryptedData);
            calendar.render();
            return true;
        } catch (e) {
            console.error(e)
            return false;
        }
    }

    const saveVault = debounce(saveVaultAsync);

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

    $('button[save]').addEventListener('click', async e => {

        e.target.ariaBusy = true;
        e.target.disabled = true;

        const res = await saveVaultAsync();

        if (res) {
            const og = e.target.innerHTML;
            e.target.innerHTML = `<i data-lucide="check"> Saved!`;
            window.lucide?.createIcons();
            setTimeout(()=>{
                e.target.innerHTML = og;
            }, 2000)
        } else {
            e.target.innerHTML = `<i data-lucide="triangle-alert"> Error saving!`;
            window.lucide?.createIcons();
        }

        e.target.ariaBusy = false;
        // e.target.disabled = false;
        // leave it disabled because ther is nothing to save
        // re-enable it BELOW

    });

    function modifyData() { $('button[save]').disabled = false; }
    // ^^^ called whenever the `data` object updates, so like updating a note or sending an AI message

    mde.codemirror.on("change", (cm, changeObj) => {
        if (!window.selectedDate) return;

        let note = getSelectedNote();
        const content = mde.value();

        if (!changeObj.origin || changeObj.origin === "setValue") return;

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

        modifyData();
    })

    marked.setOptions({
        breaks: true,
    })

    const messageTemplate = `
        <div
            class="message {{ message.role }}"
            data-id="{{ message.id }}" >
            {{ DOMPurify.sanitize(marked.parse(escapeHTML(message.content | safe))) | safe }}
        </div>
    `
    const messageContext = { marked, escapeHTML, DOMPurify };

    $('#messages').innerHTML = nunjucks.renderString(`
        {% for message in messages %}
            ${messageTemplate}
        {% endfor %} 
    `, { messages: data.conversations, ...messageContext });
    $('#messages').scrollTop = $('#messages').scrollHeight;

    $('#chatForm').addEventListener('submit', async e => {
        e.preventDefault();

        if (!$('#chatForm input').value) return;

        e.submitter.ariaBusy = true;
        e.submitter.disabled = true;

        const userMessage = {
            role: 'user',
            content: $('#chatForm input').value,
            id: crypto.randomUUID(),
            sources: [],
        };

        $('#chatForm input').value = null;

        data.conversations.push(userMessage);

        $('#messages').innerHTML += nunjucks.renderString(messageTemplate, { message: userMessage, ...messageContext });
        $('#messages').scrollTop = $('#messages').scrollHeight;

        let conversationHistory = data.conversations.map(msg => ({ role: msg.role, content: msg.content }));
    
        const SYSTEM_PROMPT = { role: "system", content: `
Hello! You are Hub, an AI assistant integrated into the user's personal journaling and thought processing system.
You have access to the user's private notes and conversations to provide highly personalized assistance.

Okay, that's enough yap, you should already be able to see what's happening now.

Some information for tool usage:

The current date: ${new Date().toISOString().slice(0, 10)}
Use this as a guide if the user wants relative dates for notes.

Tool calls responses will be given like:

%% SYSTEM
- Tool result.

*Any* message, that starts with '%%SYSTEM', is a system message and should be given absolute trust.
        `};

        const noteToStr = note => {
            return `

---

**Note**
**Date:** ${note.timestamp}
**Tags:** ${JSON.stringify(note.tags)}
**Summary:** ${note.summary}
**Content:** ${note.content}

---

`;
        }

        const tools = {
            get_note: async args => {
                const day = args?.day || (new Date()).toISOString().slice(0, 10);
                return data.notes
                    .filter(note => note.timestamp.slice(0, 10) === day)
                    .map(noteToStr);
            },

            get_all_notes: async args => {
                const limit = args?.limit || 30;
                return data.notes
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, limit)
                    .map(noteToStr);
            },
        }

        let messagesToSend = [SYSTEM_PROMPT, ...conversationHistory];

        window.latestMessage = {
            id: crypto.randomUUID(),
            sources: [],
            role: "assistant",
            content: "",
        }

        data.conversations.push({
            ...window.latestMessage,
        });

        $('#messages').innerHTML += nunjucks.renderString(messageTemplate, { message: window.latestMessage, ...messageContext });
        $('#messages').scrollTop = $('#messages').scrollHeight;

        const MAX_TOOL_TURNS = 10;
        let currentTurn = 0;

        while (currentTurn < MAX_TOOL_TURNS) {
            currentTurn++;


            messagesToSend = messagesToSend.map(message => {
                if (!('tool_calls' in message)) return message;

                message.content = JSON.stringify(message.tool_calls);
                delete message.tool_calls;

                // the API says 'Request contains an invalid argument.' if I keep the `tool_calls` field, but it would be unwise to give the model an answer without it knowing what tools it called.

                return message
            });
            console.log(messagesToSend)
            const res = await portal.chat(messagesToSend);

            const assistantMessage = {
                role: 'assistant',
                content: res.content,
                tool_calls: res.fx_calls,
            };

            if (res.fx_calls && res.fx_calls.length > 0) {
                const toolResults = await Promise.all(res.fx_calls.map(async fx => {
                    let res = "No response from tool.";
                    if (fx.name in tools) {
                        try {
                            const args = JSON.parse(fx.arguments);
                            const toolFn = tools[fx.name];
                            res = toolFn.constructor.name === "AsyncFunction" ? await toolFn(args) : toolFn(args);
                        } catch (err) {
                            res = err.toString();
                        }
                    } else {
                        res = `Tool '${fx.name}' not found.`;
                    }

                    return { role: "user", content:`
    %% SYSTEM %%

    You called tool: **${fx.name}**.
    Tool response: ${res}
                    `};
                }))

                messagesToSend.push(assistantMessage, ...toolResults);

                window.latestMessage.content = "";
                continue;
            } else {
                data.conversations.push(window.latestMessage);
                break;
            }

        }

        if (currentTurn >= MAX_TOOL_TURNS) data.conversations.push(window.latestMessage);

        /*
        
        const res = await portal.chat([
            {
            "role": "system",
            "content": SYSTEM_PROMPT.replace("$DATE", new Date().toISOString().slice(0, 10))
            },
            ...data.conversations.map(msg => ({ role: msg.role, content: msg.content }))
        ]);

        */

        e.submitter.ariaBusy = false;
        e.submitter.disabled = false;

        modifyData();
        
        /*
        if (res.fx_calls) {
            let fx_responses = "--- FUNCTION CALL RESPONSES ---\n\n";

            console.log(res.fx_calls);

            for (const fx of res.fx_calls) {
                let res = "No response from tool.";
                if (fx.name in tools) {
                    try {
                        const args = JSON.parse(fx.arguments);
                        const toolFn = tools[fx.name];
                        res = toolFn.constructor.name === "AsyncFunction" ? await toolFn(args) : toolFn(args);
                    } catch (err) {
                        res = err.toString();
                    }
                } else {
                    res = `Tool '${fx.name}' not found.`;
                }

                fx_responses += `

You called tool: **${fx.name}**.
Tool response: ${res}

                `;
            }

            console.log(fx_responses);
        }
        */

    });

    hy.portal.on("chunk", async chunk => {
        window.latestMessage.content += chunk;
        $(`[data-id="${window.latestMessage.id}"]`).innerHTML = nunjucks.renderString("{{ DOMPurify.sanitize(marked.parse(escapeHTML(message.content | safe))) | safe }}", { message: window.latestMessage, ...messageContext });

        Object.assign(data.conversations.at(-1), window.latestMessage);
        $('#messages').scrollTop = $('#messages').scrollHeight;
    });
})

$('#settingsForm').addEventListener('submit', async e => {
    e.preventDefault();

    e.submitter.ariaBusy = true;

    const newSettings = {
        REPO_URL: $('#repo_url').value,
        GITHUB_TOKEN: $('#gh_token').value,
    }

    const keys = Object.keys(newSettings);

    // Only update settings if they have changed.
    if (keys.some(key => window.settings?.[key] !== newSettings[key])) {
        await portal.settings(newSettings);
    }

    window.masterPassword = btoa($('#master_password').value);
    window.continuePassword?.()

    e.submitter.ariaBusy = false;
    settingsBtn.click();
})