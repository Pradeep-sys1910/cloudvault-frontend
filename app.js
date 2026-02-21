const API_BASE = "https://cloudvault-backend-ntkz.onrender.com";

let allFiles = [];

/* ================= AUTH GUARD ================= */
function requireAuth() {
    if (!localStorage.getItem("token")) {
        window.location = "login.html";
    }
}

/* ================= SIGNUP ================= */
async function signup() {
    const btn = document.getElementById("signupBtn");
    const msg = document.getElementById("signupMsg");

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!name || !email || !password) {
        showMsg(msg, "❌ All fields are required", "error");
        return;
    }

    btn.innerText = "Creating...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();

        if (res.status === 201) {
            showMsg(msg, "📧 Verification email sent! Check your inbox.", "success");
            btn.innerText = "Check Your Email";
        } else {
            showMsg(msg, "❌ " + data.error, "error");
            btn.innerText = "Create Account";
            btn.disabled = false;
        }
    } catch (e) {
        showMsg(msg, "❌ Server unreachable. Try again.", "error");
        btn.innerText = "Create Account";
        btn.disabled = false;
    }
}

/* ================= LOGIN ================= */
async function login() {
    const btn = document.getElementById("loginBtn");
    const msg = document.getElementById("loginMsg");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        showMsg(msg, "❌ Enter email and password", "error");
        return;
    }

    btn.innerText = "Logging in...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (data.token) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("userName", data.name || email.split("@")[0]);
            window.location = "dashboard.html";
        } else {
            showMsg(msg, "❌ " + data.error, "error");
            btn.innerText = "Login";
            btn.disabled = false;
        }
    } catch (e) {
        showMsg(msg, "❌ Server unreachable. Try again.", "error");
        btn.innerText = "Login";
        btn.disabled = false;
    }
}

/* ================= LOGOUT ================= */
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    window.location = "login.html";
}

/* ================= SHOW FILE NAME ================= */
function showFileName() {
    const input = document.getElementById("fileInput");
    const label = document.getElementById("selectedFileName");
    if (input.files[0]) {
        const sizeMB = (input.files[0].size / (1024 * 1024)).toFixed(2);
        label.innerText = `📎 ${input.files[0].name} (${sizeMB} MB)`;
    }
}

/* ================= UPLOAD WITH PROGRESS ================= */
function uploadFile() {
    requireAuth();
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please choose a file first.");
        return;
    }

    // 50MB client-side check
    if (file.size > 50 * 1024 * 1024) {
        alert("File too large. Maximum size is 50MB.");
        return;
    }

    const progressBox = document.getElementById("uploadProgressBox");
    const progressBar = document.getElementById("uploadProgress");
    const progressText = document.getElementById("uploadPercent");

    progressBox.style.display = "block";
    progressBar.style.width = "0%";
    progressText.innerText = "0%";

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/upload`);
    xhr.setRequestHeader("Authorization", "Bearer " + localStorage.getItem("token"));

    xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = pct + "%";
            progressText.innerText = pct + "%";
        }
    };

    xhr.onload = () => {
        progressBox.style.display = "none";
        fileInput.value = "";
        document.getElementById("selectedFileName").innerText = "";

        const res = JSON.parse(xhr.responseText);
        if (xhr.status === 200) {
            showToast("✅ File uploaded!");
            loadFiles();
        } else {
            showToast("❌ " + (res.error || "Upload failed"), "error");
        }
    };

    xhr.onerror = () => {
        progressBox.style.display = "none";
        showToast("❌ Upload failed. Check your connection.", "error");
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
}

/* ================= LOAD FILES ================= */
async function loadFiles() {
    requireAuth();

    // Show skeleton loaders
    const list = document.getElementById("fileList");
    list.innerHTML = `
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton"></div>
    `;

    try {
        const res = await fetch(`${API_BASE}/files`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
        });

        if (res.status === 401) {
            logout();
            return;
        }

        const data = await res.json();

        // Updated to match new backend response format: {files: [...], storage: {...}}
        allFiles = data.files || data; // supports both old and new format
        const storage = data.storage || null;

        renderFiles(allFiles);
        updateStorageBar(storage, allFiles);

        // Show user name
        const nameEl = document.getElementById("userName");
        if (nameEl) {
            nameEl.innerText = localStorage.getItem("userName") || "User";
        }

    } catch (e) {
        list.innerHTML = `<p class="error-text">Failed to load files. Check your connection.</p>`;
    }
}

/* ================= RENDER FILES ================= */
function getFileIcon(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const icons = {
        pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊",
        ppt: "📑", pptx: "📑", jpg: "🖼️", jpeg: "🖼️", png: "🖼️",
        gif: "🎞️", mp4: "🎬", mp3: "🎵", wav: "🎵", zip: "🗜️",
        rar: "🗜️", txt: "📃", csv: "📊", json: "⚙️", svg: "🎨"
    };
    return icons[ext] || "📁";
}

function renderFiles(files) {
    const list = document.getElementById("fileList");
    list.innerHTML = "";

    if (!files || files.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">☁️</div>
                <p>No files yet. Upload your first file!</p>
            </div>`;
        return;
    }

    files.forEach(file => {
        const icon = getFileIcon(file.name);
        const sizeDisplay = file.size_kb ? `${file.size_kb} KB` : `${file.size} KB`;
        const dateDisplay = file.uploaded_at || "";

        list.innerHTML += `
        <div class="file-card" data-name="${file.name}">
            <div class="file-icon">${icon}</div>
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-meta">${sizeDisplay}${dateDisplay ? ` · ${dateDisplay}` : ""}</div>
            <div class="file-actions">
                <button class="btn-download" onclick="downloadFile('${file.name}')">⬇ Download</button>
                <button class="btn-delete" onclick="confirmDelete('${file.name}')">🗑 Delete</button>
            </div>
        </div>`;
    });
}

/* ================= STORAGE BAR ================= */
function updateStorageBar(storage, files) {
    const storageText = document.getElementById("storageText");
    const storageBar = document.getElementById("storageBar");
    const storageBarFill = document.getElementById("storageBarFill");

    let usedMB, limitMB = 200, pct;

    if (storage) {
        usedMB = storage.used_mb;
        pct = Math.min((usedMB / limitMB) * 100, 100).toFixed(1);
    } else {
        // Fallback: calculate from file list
        let totalKB = 0;
        (files || []).forEach(f => totalKB += (f.size_kb || f.size || 0));
        usedMB = (totalKB / 1024).toFixed(2);
        pct = Math.min((usedMB / limitMB) * 100, 100).toFixed(1);
    }

    const count = (files || []).length;

    if (storageText) {
        storageText.innerHTML = `
            <span>${usedMB} MB used of ${limitMB} MB</span>
            <span>${count} file${count !== 1 ? "s" : ""}</span>
        `;
    }

    if (storageBarFill) {
        storageBarFill.style.width = pct + "%";
        storageBarFill.style.background = pct > 85
            ? "linear-gradient(90deg, #ef4444, #f87171)"
            : "linear-gradient(90deg, #60a5fa, #2563eb)";
    }
}

/* ================= SEARCH ================= */
function searchFiles() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filtered = allFiles.filter(f => f.name.toLowerCase().includes(query));
    renderFiles(filtered);
}

/* ================= SORT ================= */
function sortFiles() {
    const val = document.getElementById("sortSelect").value;
    let sorted = [...allFiles];

    if (val === "name") {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (val === "size") {
        sorted.sort((a, b) => (b.size_kb || b.size || 0) - (a.size_kb || a.size || 0));
    } else if (val === "date") {
        sorted.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0));
    }

    renderFiles(sorted);
}

/* ================= DELETE WITH CONFIRM ================= */
function confirmDelete(filename) {
    const modal = document.getElementById("deleteModal");
    const nameEl = document.getElementById("deleteFileName");
    if (modal) {
        nameEl.innerText = filename;
        modal.style.display = "flex";
        modal.dataset.target = filename;
    } else {
        // Fallback if no modal
        if (confirm(`Delete "${filename}"?`)) deleteFile(filename);
    }
}

function closeDeleteModal() {
    const modal = document.getElementById("deleteModal");
    if (modal) modal.style.display = "none";
}

async function confirmDeleteAction() {
    const modal = document.getElementById("deleteModal");
    const filename = modal.dataset.target;
    closeDeleteModal();
    await deleteFile(filename);
}

async function deleteFile(filename) {
    try {
        const res = await fetch(`${API_BASE}/delete/${encodeURIComponent(filename)}`, {
            method: "DELETE",
            headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
        });

        if (res.ok) {
            showToast("🗑 File deleted");
            loadFiles();
        } else {
            showToast("❌ Delete failed", "error");
        }
    } catch (e) {
        showToast("❌ Delete failed", "error");
    }
}

/* ================= DOWNLOAD ================= */
async function downloadFile(filename) {
    try {
        const res = await fetch(`${API_BASE}/download/${encodeURIComponent(filename)}`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
        });

        const data = await res.json();
        if (data.url) {
            window.open(data.url, "_blank");
        } else {
            showToast("❌ Download failed", "error");
        }
    } catch (e) {
        showToast("❌ Download failed", "error");
    }
}

/* ================= FORGOT PASSWORD ================= */
async function forgotPassword() {
    const email = document.getElementById("resetEmail").value.trim();
    const msg = document.getElementById("forgotMsg");
    const btn = document.getElementById("forgotBtn");

    if (!email) {
        showMsg(msg, "❌ Enter your email", "error");
        return;
    }

    btn.innerText = "Sending...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await res.json();

        if (res.ok) {
            showMsg(msg, "📧 " + data.message, "success");
            btn.innerText = "Email Sent";
        } else {
            showMsg(msg, "❌ " + data.error, "error");
            btn.innerText = "Send Reset Link";
            btn.disabled = false;
        }
    } catch (e) {
        showMsg(msg, "❌ Server unreachable", "error");
        btn.innerText = "Send Reset Link";
        btn.disabled = false;
    }
}

/* ================= RESET PASSWORD ================= */
async function resetPassword() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const password = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword") ? document.getElementById("confirmPassword").value : password;
    const msg = document.getElementById("resetMsg");
    const btn = document.getElementById("resetBtn");

    if (!token) {
        showMsg(msg, "❌ Invalid reset link", "error");
        return;
    }

    if (password.length < 6) {
        showMsg(msg, "❌ Password must be at least 6 characters", "error");
        return;
    }

    if (password !== confirm) {
        showMsg(msg, "❌ Passwords do not match", "error");
        return;
    }

    btn.innerText = "Updating...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_BASE}/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, password })
        });

        const data = await res.json();

        if (res.ok) {
            showMsg(msg, "✅ Password updated! Redirecting...", "success");
            setTimeout(() => window.location = "login.html", 2000);
        } else {
            showMsg(msg, "❌ " + data.error, "error");
            btn.innerText = "Update Password";
            btn.disabled = false;
        }
    } catch (e) {
        showMsg(msg, "❌ Server unreachable", "error");
        btn.innerText = "Update Password";
        btn.disabled = false;
    }
}

/* ================= TOAST NOTIFICATION ================= */
function showToast(message, type = "success") {
    const existing = document.getElementById("toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "toast";
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("toast-show"), 10);
    setTimeout(() => {
        toast.classList.remove("toast-show");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

/* ================= MSG HELPER ================= */
function showMsg(el, text, type) {
    if (!el) return;
    el.innerText = text;
    el.className = `msg msg-${type}`;
}
