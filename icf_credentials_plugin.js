/**
 * ICF Collect — Credentials Plugin v1.0
 * =========================================
 * Drop-in plugin that adds form access control to ICF Collect.
 *
 * INSTALL: Add this ONE line before </body> in your HTML:
 *   <script src="icf_credentials_plugin.js"></script>
 *
 * That's it. No other changes needed.
 */

(function() {
'use strict';

// ==================== 1. INJECT CSS ====================
const css = `
    #credentialsPanel {
        margin-top: 20px; padding: 14px; background: #f8faff;
        border: 1px solid #d0e0f5; border-radius: 8px;
    }
    #sharedFormLoginGate {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: linear-gradient(135deg, #004080, #001a33);
        display: none; justify-content: center; align-items: center;
        z-index: 9999; padding: 20px; font-family: 'Oswald', Arial, sans-serif;
    }
    #sharedFormLoginGate.show { display: flex; }
    .sfg-card {
        background: #fff; border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,.3);
        padding: 40px 36px; width: 100%; max-width: 420px;
    }
    .sfg-logo { text-align: center; margin-bottom: 28px; }
    .sfg-logo .sfg-icon { font-size: 44px; display: block; margin-bottom: 12px; }
    .sfg-logo h2 { margin: 0 0 6px; font-size: 20px; color: #004080; font-weight: 700; }
    .sfg-logo p { margin: 0; font-size: 13px; color: #666; }
    .sfg-msg { padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 14px; display: none; }
    .sfg-msg.error { background: #fff0f0; border: 1px solid #ffcccc; color: #cc0000; display: block; }
    .sfg-msg.success { background: #f0fff4; border: 1px solid #c3e6cb; color: #155724; display: block; }
    .sfg-fields { display: flex; flex-direction: column; gap: 16px; }
    .sfg-group label {
        display: block; font-size: 11px; font-weight: 700; color: #444;
        margin-bottom: 5px; text-transform: uppercase; letter-spacing: .5px;
    }
    .sfg-group input {
        width: 100%; padding: 11px 13px; border: 2px solid #d0d9e8;
        border-radius: 8px; font-size: 14px; box-sizing: border-box;
        font-family: 'Oswald', sans-serif;
    }
    .sfg-group input:focus { outline: none; border-color: #004080; box-shadow: 0 0 0 3px rgba(0,64,128,.1); }
    .sfg-btn {
        background: #004080; color: #fff; border: none; border-radius: 8px;
        padding: 13px; font-size: 15px; font-weight: 700; cursor: pointer;
        font-family: 'Oswald', sans-serif;
    }
    .sfg-btn:hover { background: #003060; }
    @keyframes sfgShake {
        0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)}
        40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
    }
    .sfg-shake { animation: sfgShake .45s ease; }
    #shareNote { font-size: 12px; margin-top: 8px; padding: 8px 12px; border-radius: 6px; display: none; }
`;

const styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);

// ==================== 2. INJECT HTML ELEMENTS ====================
document.addEventListener('DOMContentLoaded', function() {

    // 2a. Login Gate — added before .notification div
    const notifEl = document.getElementById('notification');
    if (notifEl) {
        const gateHtml = `
            <div id="sharedFormLoginGate">
                <div class="sfg-card">
                    <div class="sfg-logo">
                        <span class="sfg-icon">&#128274;</span>
                        <h2 id="sfgFormTitle">Form</h2>
                        <p>This form requires login to access.</p>
                    </div>
                    <div id="sfgMsg" class="sfg-msg"></div>
                    <div class="sfg-fields">
                        <div class="sfg-group">
                            <label>Username</label>
                            <input type="text" id="sfgUsername" placeholder="Enter your username"
                                   onkeydown="if(event.key==='Enter') sfgLogin()">
                        </div>
                        <div class="sfg-group">
                            <label>Password</label>
                            <input type="password" id="sfgPassword" placeholder="Enter your password"
                                   onkeydown="if(event.key==='Enter') sfgLogin()">
                        </div>
                        <button class="sfg-btn" onclick="sfgLogin()">Access Form &#8594;</button>
                    </div>
                </div>
            </div>`;
        notifEl.insertAdjacentHTML('beforebegin', gateHtml);
    }

    // 2b. Credentials Panel — added inside properties panel
    const propertiesPanel = document.getElementById('propertiesPanel');
    if (propertiesPanel) {
        const panelDiv = document.createElement('div');
        panelDiv.id = 'credentialsPanel';
        propertiesPanel.appendChild(panelDiv);
    }

    // 2c. shareNote — added after qr-actions in share modal
    const qrActions = document.querySelector('#shareModal .qr-actions');
    if (qrActions) {
        const noteEl = document.createElement('p');
        noteEl.id = 'shareNote';
        qrActions.after(noteEl);
    }

    // 2d. Initialize credentials panel when builder is shown
    // We hook into showBuilder by watching for mainContainer visibility changes
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    if (mainContainer.classList.contains('show')) {
                        setTimeout(renderCredentialsPanel, 100);
                    }
                }
            });
        });
        observer.observe(mainContainer, { attributes: true });
    }
});

// ==================== 3. FORM CREDENTIALS STATE ====================
window.formCredentials = [];

// ==================== 4. CREDENTIALS PANEL UI ====================
window.renderCredentialsPanel = function() {
    const panel = document.getElementById('credentialsPanel');
    if (!panel) return;

    // Load saved credentials
    try {
        const saved = localStorage.getItem('icfFormCredentials');
        window.formCredentials = saved ? JSON.parse(saved) : [];
    } catch(e) { window.formCredentials = []; }

    panel.innerHTML = `
        <div style="margin-top:5px;">
            <div style="font-size:11px;font-weight:700;color:#004080;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">
                &#128274; Form Access Credentials
            </div>
            <p style="font-size:11px;color:#666;margin:0 0 10px;">
                Users must log in before accessing the shared form.
            </p>
            <div id="sfgCredList" style="margin-bottom:10px;"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:end;">
                <div>
                    <label style="font-size:10px;color:#555;display:block;margin-bottom:3px;font-weight:700;text-transform:uppercase;">Username</label>
                    <input type="text" id="sfgNewUser" placeholder="e.g. john"
                           style="width:100%;padding:7px 9px;border:1px solid #ccc;border-radius:4px;font-family:'Oswald',sans-serif;font-size:12px;box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:10px;color:#555;display:block;margin-bottom:3px;font-weight:700;text-transform:uppercase;">Password</label>
                    <input type="password" id="sfgNewPass" placeholder="••••••••"
                           style="width:100%;padding:7px 9px;border:1px solid #ccc;border-radius:4px;font-family:'Oswald',sans-serif;font-size:12px;box-sizing:border-box;">
                </div>
                <button onclick="sfgAddCredential()"
                        style="padding:7px 12px;background:#004080;color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:'Oswald',sans-serif;font-weight:700;font-size:12px;height:32px;align-self:end;">
                    + Add
                </button>
            </div>
            <div id="sfgCredMsg" style="font-size:11px;margin-top:5px;display:none;"></div>
        </div>`;

    sfgRenderCredList();
};

window.sfgRenderCredList = function() {
    const list = document.getElementById('sfgCredList');
    if (!list) return;
    if (!window.formCredentials || window.formCredentials.length === 0) {
        list.innerHTML = '<p style="font-size:11px;color:#aaa;font-style:italic;margin:0;">No credentials set — form is open access.</p>';
        return;
    }
    list.innerHTML = window.formCredentials.map((cred, i) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#f0f5ff;border:1px solid #c5d8f5;border-radius:4px;margin-bottom:5px;">
            <div>
                <span style="font-weight:700;font-size:12px;color:#004080;">${cred.username}</span>
                <span style="font-size:10px;color:#888;margin-left:8px;">••••••••</span>
            </div>
            <button onclick="sfgRemoveCredential(${i})"
                    style="background:none;border:none;color:#cc0000;cursor:pointer;font-size:18px;line-height:1;padding:0 4px;">×</button>
        </div>
    `).join('');
};

window.sfgAddCredential = function() {
    const userInput = document.getElementById('sfgNewUser');
    const passInput = document.getElementById('sfgNewPass');
    const msg       = document.getElementById('sfgCredMsg');
    const username  = userInput.value.trim();
    const password  = passInput.value.trim();

    if (!username || !password) {
        msg.textContent = 'Both username and password are required.';
        msg.style.color = 'red'; msg.style.display = 'block'; return;
    }
    if (window.formCredentials.some(c => c.username.toLowerCase() === username.toLowerCase())) {
        msg.textContent = 'Username already exists.';
        msg.style.color = 'red'; msg.style.display = 'block'; return;
    }
    window.formCredentials.push({ username, password });
    try { localStorage.setItem('icfFormCredentials', JSON.stringify(window.formCredentials)); } catch(e) {}
    userInput.value = ''; passInput.value = '';
    msg.textContent = `✓ "${username}" added.`;
    msg.style.color = 'green'; msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2500);
    sfgRenderCredList();
    if (typeof notify === 'function') notify(`Credential "${username}" added`, 'success');
};

window.sfgRemoveCredential = function(index) {
    if (!confirm(`Remove user "${window.formCredentials[index].username}"?`)) return;
    window.formCredentials.splice(index, 1);
    try { localStorage.setItem('icfFormCredentials', JSON.stringify(window.formCredentials)); } catch(e) {}
    sfgRenderCredList();
};

// ==================== 5. LOGIN GATE ====================
window.sfgLogin = function() {
    const username = document.getElementById('sfgUsername').value.trim();
    const password = document.getElementById('sfgPassword').value.trim();
    const msg      = document.getElementById('sfgMsg');

    if (!username || !password) {
        msg.textContent = 'Please enter both username and password.';
        msg.className = 'sfg-msg error'; return;
    }
    const creds = window._sfgCredentials || [];
    const match = creds.find(c =>
        c.username.toLowerCase() === username.toLowerCase() && c.password === password
    );
    if (!match) {
        msg.textContent = '✗ Invalid username or password.';
        msg.className = 'sfg-msg error';
        const card = document.querySelector('.sfg-card');
        if (card) { card.classList.add('sfg-shake'); setTimeout(() => card.classList.remove('sfg-shake'), 500); }
        return;
    }
    msg.textContent = `✓ Welcome, ${match.username}!`;
    msg.className = 'sfg-msg success';
    setTimeout(() => {
        document.getElementById('sharedFormLoginGate').classList.remove('show');
        document.getElementById('viewerContainer').classList.add('show');
    }, 600);
};

// ==================== 6. OVERRIDE shareForm() ====================
// Wait for the original app to load, then override
window.addEventListener('load', function() {
    // Small delay to ensure original script has run
    setTimeout(function() {
        const _originalShareForm = window.shareForm;

        window.shareForm = async function() {
            if (!window.state || !window.state.fields || window.state.fields.length === 0) {
                if (typeof notify === 'function') notify('Add fields!', 'error');
                return;
            }

            // Load latest credentials
            try {
                const saved = localStorage.getItem('icfFormCredentials');
                window.formCredentials = saved ? JSON.parse(saved) : [];
            } catch(e) { window.formCredentials = []; }

            // Temporarily inject credentials into state.settings
            const origSettings = Object.assign({}, window.state.settings);
            window.state.settings._sfgCreds = window.formCredentials;

            // Call original shareForm which will serialize state.settings
            // We intercept after URL is generated
            const origShareUrl = document.getElementById('shareUrl');
            const observer = new MutationObserver(function(mutations) {
                observer.disconnect();
                // shareNote
                const note = document.getElementById('shareNote');
                if (note) {
                    if (window.formCredentials.length === 0) {
                        note.textContent = '⚠️ No credentials set — this form is open to everyone.';
                        note.style.background = '#fff3cd'; note.style.color = '#856404';
                    } else {
                        note.textContent = `🔒 ${window.formCredentials.length} credential(s) embedded. Users must log in.`;
                        note.style.background = '#d4edda'; note.style.color = '#155724';
                    }
                    note.style.display = 'block';
                }
            });
            if (origShareUrl) observer.observe(origShareUrl, { childList: true, subtree: true, characterData: true });

            await _originalShareForm();

            // Restore settings
            window.state.settings = origSettings;
        };

        // ==================== 7. OVERRIDE renderSharedForm() ====================
        const _originalRenderSharedForm = window.renderSharedForm;

        window.renderSharedForm = async function(data) {
            // Extract embedded credentials
            const embeddedCreds = data.s && data.s._sfgCreds ? data.s._sfgCreds : [];

            if (embeddedCreds.length > 0) {
                // Store credentials for login gate
                window._sfgCredentials = embeddedCreds;

                // Set form title in login gate
                const titleEl = document.getElementById('sfgFormTitle');
                if (titleEl) titleEl.textContent = (data.s && data.s.t) ? data.s.t : 'Form';

                // Hide header/footer
                const header = document.querySelector('.header');
                const footer = document.querySelector('.footer');
                const authContainer = document.getElementById('authContainer');
                const mainContainer = document.getElementById('mainContainer');
                if (header) header.style.display = 'none';
                if (footer) footer.style.display = 'none';
                if (authContainer) authContainer.style.display = 'none';
                if (mainContainer) mainContainer.classList.remove('show');

                // Show login gate (viewerContainer stays hidden until login succeeds)
                const gate = document.getElementById('sharedFormLoginGate');
                if (gate) gate.classList.add('show');

                // Call original to set up state & render form (but viewerContainer hidden)
                await _originalRenderSharedForm(data);

                // Make viewerContainer invisible until login — override the show
                const viewerContainer = document.getElementById('viewerContainer');
                if (viewerContainer) viewerContainer.classList.remove('show');

            } else {
                // No credentials — open access, pass through to original
                window._sfgCredentials = [];
                await _originalRenderSharedForm(data);
            }
        };

        console.log('✅ ICF Credentials Plugin loaded successfully');

    }, 500);
});

})(); // End IIFE
