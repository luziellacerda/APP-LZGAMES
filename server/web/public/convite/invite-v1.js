"use strict";
(() => {
  const el = id => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  const refs = params.getAll("ref");
  const raw = refs.length === 1 ? refs[0].trim() : "";
  const hasRef = refs.length > 0;
  const formatOK = refs.length === 1 && raw.length <= 1024 && /^LZ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/.test(raw);
  let loading = false, confirmedCode = "", copying = false;

  function showError(message, retry) {
    el("page-status").textContent = message;
    el("page-status").dataset.state = "error";
    el("retry").hidden = !retry;
    el("without-invite").hidden = retry;
  }
  function validRelease(release) {
    if (!release || release.name !== "LZ-GAMES" || !/^\d+\.\d+\.\d+$/.test(release.version)
      || !Number.isSafeInteger(release.version_code) || release.version_code < 23
      || !Number.isSafeInteger(release.size_bytes) || release.size_bytes <= 0 || release.size_bytes > 180 * 1024 * 1024
      || !/^[a-f0-9]{64}$/.test(release.sha256)) return false;
    // Keep downloads on the official host; never follow a query-supplied URL.
    return release.apk_url === `https://app.lzgames.com.br/convite/lz-games-${release.version_code}.apk`;
  }
  async function load() {
    if (loading) return;
    loading = true; confirmedCode = "";
    for (const id of ["retry", "without-invite", "invite-section", "download-section", "use-invite", "generic-note"]) el(id).hidden = true;
    el("download-apk").removeAttribute("href");
    el("invite-code").value = "";
    el("page-status").textContent = "Conferindo as informações do aplicativo…";
    delete el("page-status").dataset.state;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    try {
      if (hasRef && !formatOK) { showError("Este link de convite está incompleto ou inválido. Peça um novo link a quem indicou você.", false); return; }
      const response = await fetch(`/api/app/invite-info${hasRef ? `?ref=${encodeURIComponent(raw)}` : ""}`, {
        method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
        headers: {Accept: "application/json"}, referrerPolicy: "no-referrer",
      });
      if (response.status === 400) { showError("Este convite não é válido. Peça um novo link a quem indicou você.", false); return; }
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("UNAVAILABLE");
      const body = await response.json();
      if (body?.ok !== true || body.data?.has_invite !== hasRef || !validRelease(body.data?.release)) throw new Error("INVALID_RESPONSE");
      const release = body.data.release;
      confirmedCode = hasRef ? raw : "";
      el("invite-title").textContent = hasRef ? "Você está convidado." : "Seu app está aqui.";
      el("page-status").textContent = hasRef ? "Convite conferido. Siga os três passos para usar no app." : "Baixe o aplicativo oficial e crie sua conta dentro dele.";
      el("invite-code").value = confirmedCode;
      el("invite-section").hidden = !hasRef;
      el("use-invite").hidden = !hasRef;
      el("generic-note").hidden = hasRef;
      el("download-step").textContent = hasRef ? "02" : "01";
      el("release-label").textContent = `Android · versão ${release.version} · APK ${release.version_code} · ${Math.ceil(release.size_bytes / 1000000)} MB`;
      el("apk-hash").textContent = release.sha256;
      el("download-apk").href = release.apk_url;
      el("download-apk").download = `LZ-GAMES-${release.version_code}.apk`;
      el("download-section").hidden = false;
    } catch {
      showError("Não foi possível conferir o convite e o download agora. Tente novamente; nenhuma indicação foi vinculada.", true);
    } finally { clearTimeout(timeout); loading = false; }
  }
  async function copy() {
    if (!confirmedCode || copying) return;
    copying = true; el("copy-code").disabled = true;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        let timer;
        try { await Promise.race([navigator.clipboard.writeText(confirmedCode), new Promise((_, reject) => {timer = setTimeout(() => reject(new Error("TIMEOUT")), 1500);})]); copied = true; }
        finally { clearTimeout(timer); }
      }
    } catch { /* Manual selection below remains usable when clipboard is denied. */ }
    if (!copied) {
      el("invite-code").focus(); el("invite-code").select();
      el("invite-code").setSelectionRange(0, confirmedCode.length);
      try { copied = document.execCommand("copy"); } catch { copied = false; }
    }
    el("copy-code").textContent = copied ? "Copiado ✓" : "Copiar";
    el("copy-status").textContent = copied ? "Convite copiado. Após instalar, cole em “Recebi um convite” antes de entrar ou se cadastrar." : "O navegador bloqueou a cópia. O código está selecionado: use a opção Copiar do seu telefone ou cole o link completo recebido no app.";
    copying = false; el("copy-code").disabled = false;
  }
  el("retry").addEventListener("click", load);
  el("copy-code").addEventListener("click", copy);
  void load();
})();
