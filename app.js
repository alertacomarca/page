/******************************************************************
 * UTILIDADES
 ******************************************************************/
const $ = (sel) => document.querySelector(sel);
const escapeHtml = (s) => (s ?? "").replace(/[&<>"']/g, m => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));
const fmtDate = (isoish) => {
  // isoish: "YYYY-MM-DD HH:mm"
  if(!isoish) return "—";

  try {
    const [dateStr, timeStr] = isoish.split(" ");
    const [year, month, day] = dateStr.split("-");

    const date = new Date(year, month - 1, day);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Resetear horas para comparación
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    let dateLabel;
    if (date.getTime() === today.getTime()) {
      dateLabel = "Hoy";
    } else if (date.getTime() === yesterday.getTime()) {
      dateLabel = "Ayer";
    } else {
      dateLabel = `${day}/${month}/${year}`;
    }

    return timeStr ? `${dateLabel} ${timeStr}` : dateLabel;
  } catch {
    return isoish;
  }
}
const levelTagClass = (level) => {
  const v = (level||"").toUpperCase();
  if(v === "EMERGENCIA") return "danger";
  if(v === "ALERTA") return "need";
  if(v === "PRECAUCIÓN" || v === "PRECAUCION") return "";
  return "ok";
}
const priorityColorTag = (p) => {
  const v = (p||"").toUpperCase();
  if(v === "ALTA") return "danger";
  if(v === "MEDIA") return "need";
  return "";
}

// Variable global para almacenar la configuración
let CONFIG = null;

/******************************************************************
 * CARGAR DATOS (ahora desde múltiples archivos)
 ******************************************************************/
// Función para evitar caché en los fetch
const fetchNoCache = (url) => fetch(url, { cache: 'no-store' });

async function loadConfig() {
  try {
    // Cargar configuración principal (editorName, status)
    const mainResp = await fetchNoCache('config.json');
    if (!mainResp.ok) throw new Error('Error cargando config.json');
    const mainJson = await mainResp.json();

    // Valores por defecto en caso de archivos faltantes
    CONFIG = {
      editorName: mainJson.editorName || 'Equipo (editar aquí)',
      status: mainJson.status || { level: 'ALERTA', note: '' },
      needs: [],
      updates: [],
      dropoffs: [],
      donations: [],
      emergencyContacts: [],
      quickLinks: [],
      whatsappGroups: null,
      volunteerWhatsAppNumber: ''
    };

    // Cargar los archivos restantes en paralelo (no fallar si alguno falta)
    const files = await Promise.all([
      fetchNoCache('necesidades.json').then(r=> r.ok ? r.json() : null).catch(()=>null),
      fetchNoCache('partes.json').then(r=> r.ok ? r.json() : null).catch(()=>null),
      fetchNoCache('puntos-acopio.json').then(r=> r.ok ? r.json() : null).catch(()=>null),
      fetchNoCache('donaciones.json').then(r=> r.ok ? r.json() : null).catch(()=>null),
      fetchNoCache('recursos.json').then(r=> r.ok ? r.json() : null).catch(()=>null),
      fetchNoCache('voluntariados.json').then(r=> r.ok ? r.json() : null).catch(()=>null)
    ]);

    const [needsJson, updatesJson, dropoffsJson, donationsJson, recursosJson, voluntJson] = files;

    if (needsJson) CONFIG.needs = Array.isArray(needsJson) ? needsJson : (needsJson.needs || []);
    if (updatesJson) CONFIG.updates = Array.isArray(updatesJson) ? updatesJson : (updatesJson.updates || []);
    if (dropoffsJson) CONFIG.dropoffs = Array.isArray(dropoffsJson) ? dropoffsJson : (dropoffsJson.dropoffs || []);
    if (donationsJson) CONFIG.donations = Array.isArray(donationsJson) ? donationsJson : (donationsJson.donations || []);
    if (recursosJson) {
      CONFIG.emergencyContacts = recursosJson.emergencyContacts || [];
      CONFIG.quickLinks = recursosJson.quickLinks || [];
    }
    if (voluntJson) {
      CONFIG.volunteerWhatsAppNumber = voluntJson.volunteerWhatsAppNumber || '';
      CONFIG.whatsappGroups = voluntJson.whatsappGroups || null;
      CONFIG.voluntariados = voluntJson.voluntariados || [];
    }

    return true;
  } catch (error) {
    console.error('Error al cargar la configuración:', error);
    alert('Error al cargar la configuración principal. Por favor, recarga la página.');
    return false;
  }
}

/******************************************************************
 * RENDER
 ******************************************************************/
function renderHeader(){
  $("#editorName").textContent = CONFIG.editorName;
  $("#buildDate").textContent = new Date().toISOString().slice(0,10);

  const pill = $("#statusPill");
  const lvl = (CONFIG.status.level||"").toUpperCase();
  pill.textContent = `Estado: ${CONFIG.status.level}`;
  pill.style.borderColor =
    lvl === "EMERGENCIA" ? "rgba(255,77,90,.45)" :
    lvl === "ALERTA" ? "rgba(255,204,102,.45)" :
    lvl === "PRECAUCIÓN" || lvl === "PRECAUCION" ? "rgba(255,255,255,.18)" :
    "rgba(96,229,154,.45)";
}

function renderAlert(){
  // Usa la última update como "alerta principal" por simplicidad
  const last = CONFIG.updates.slice().sort((a,b)=> (b.time||"").localeCompare(a.time||""))[0];
  $("#alertTitle").textContent = last ? last.title : "Sin partes cargados";
  $("#alertText").textContent = last ? last.body : "Cargar el primer parte en data.json.";
  $("#alertMeta").textContent = last ? `Fuente: ${last.source} • ${fmtDate(last.time)} • Zona: ${last.town}` : "";
  $("#lastUpdated").textContent = `Actualizado: ${last ? fmtDate(last.time) : "—"}`;
}

function renderKPIs(){
  // KPIs básicos a partir de necesidades
  const totalNeeds = CONFIG.needs.length;
  const needed = CONFIG.needs.filter(n=> (n.status||"").toUpperCase() === "SE NECESITA").length;
  const covered = CONFIG.needs.filter(n=> (n.status||"").toUpperCase() === "CUBIERTO").length;

  const sources = [...new Set(CONFIG.updates.map(u=>u.source).filter(Boolean))].length;

  $("#kpis").innerHTML = `
    <div class="kpi"><div class="lbl">Necesidades publicadas</div><div class="val">${totalNeeds}</div></div>
    <div class="kpi"><div class="lbl">Pendientes (se necesita)</div><div class="val">${needed}</div></div>
    <div class="kpi"><div class="lbl">Cubiertas</div><div class="val">${covered}</div></div>
    <div class="kpi"><div class="lbl">Fuentes activas</div><div class="val">${sources}</div></div>
  `;
}

function populateFilters(){
  // Fuentes
  const sources = [...new Set(CONFIG.updates.map(u=>u.source).filter(Boolean))].sort();
  $("#filterSource").innerHTML = `<option value="">Todas las fuentes</option>` +
    sources.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");

  // Localidades y categorías para necesidades
  const towns = [...new Set(CONFIG.needs.map(n=>n.town).filter(Boolean))].sort();
  $("#filterTown").innerHTML = `<option value="">Todas las localidades</option>` +
    towns.map(t=>`<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

  const cats = [...new Set(CONFIG.needs.map(n=>n.category).filter(Boolean))].sort();
  $("#filterCategory").innerHTML = `<option value="">Todas las categorías</option>` +
    cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function renderUpdates(){
  const q = ($("#searchUpdates").value || "").trim().toLowerCase();
  const src = $("#filterSource").value || "";

  const list = CONFIG.updates
    .slice()
    .sort((a,b)=> (b.time||"").localeCompare(a.time||""))
    .filter(u=>{
      if(src && u.source !== src) return false;
      if(!q) return true;
      const hay = `${u.title} ${u.body} ${u.town} ${u.source}`.toLowerCase();
      return hay.includes(q);
    });

  $("#updatesList").innerHTML = list.length ? list.map(u=>`
    <div class="item">
      <div class="top">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${escapeHtml(u.title)}</strong>
          <span class="tag ${levelTagClass(u.level)}">${escapeHtml(u.level || "INFO")}</span>
          <span class="tag">${escapeHtml(u.town || "—")}</span>
        </div>
        <div class="small mono">${escapeHtml(fmtDate(u.time))}</div>
      </div>
      <div class="muted">${escapeHtml(u.body)}</div>
      <div class="small">Fuente: <span class="mono">${escapeHtml(u.source || "—")}</span></div>
    </div>
  `).join("") : `<div class="muted">No hay resultados con esos filtros.</div>`;
}

function renderNeeds(){
  const town = $("#filterTown").value || "";
  const cat = $("#filterCategory").value || "";

  const list = CONFIG.needs
    .slice()
    .filter(n=>{
      if(town && n.town !== town) return false;
      if(cat && n.category !== cat) return false;
      return true;
    })
    .sort((a,b)=> {
      // Ordenar por prioridad: URGENTE > ALTA > MEDIA > BAJA
      const priorityOrder = { "URGENTE": 0, "ALTA": 1, "MEDIA": 2, "BAJA": 3 };
      const pa = priorityOrder[a.priority] ?? 99;
      const pb = priorityOrder[b.priority] ?? 99;
      if(pa !== pb) return pa - pb;
      // Luego por actualización (más recientes primero)
      return (b.updatedAt||"").localeCompare(a.updatedAt||"");
    });

  const statusToTag = (s) => {
    const v = (s||"").toUpperCase();
    if(v === "CUBIERTO") return "ok";
    if(v === "PAUSADO") return "";
    return "need";
  };

  const priorityClass = (p) => {
    const v = (p||"").toUpperCase();
    if(v === "URGENTE") return "urgente";
    if(v === "ALTA") return "alta";
    if(v === "MEDIA") return "media";
    return "baja";
  };

  const urgentCount = CONFIG.needs.filter(n => (n.priority||"").toUpperCase() === "URGENTE" && (n.status||"").toUpperCase() !== "CUBIERTO").length;

  // Actualizar badge en el tab
  const needsTab = document.querySelector('[data-tab="necesidades"]');
  if(needsTab) {
    const existingBadge = needsTab.querySelector('.urgent-badge');
    if(urgentCount > 0) {
      if(existingBadge) {
        existingBadge.textContent = urgentCount;
      } else {
        const badge = document.createElement('span');
        badge.className = 'urgent-badge';
        badge.textContent = urgentCount;
        needsTab.querySelector('.tab-label').appendChild(badge);
      }
    } else if(existingBadge) {
      existingBadge.remove();
    }
  }

  $("#needsList").innerHTML = list.length ? list.map(n=>{
    const isCovered = (n.status||"").toUpperCase() === "CUBIERTO";
    return `
    <div class="item priority-${priorityClass(n.priority)} ${isCovered ? 'covered' : ''}">
      <div class="top">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <strong>${escapeHtml(n.title)}</strong>
          <span class="tag ${priorityColorTag(n.priority)}">${escapeHtml(n.priority||"—")}</span>
          <span class="tag ${statusToTag(n.status)}">${escapeHtml(n.status||"ACTIVO")}</span>
          <span class="tag">${escapeHtml(n.town||"—")}</span>
          <span class="tag">${escapeHtml(n.category||"—")}</span>
        </div>
        ${n.updatedAt ? `<div class="small mono">Actualizado: ${escapeHtml(fmtDate(n.updatedAt))}</div>` : ""}
      </div>
      <div class="muted">${escapeHtml(n.detail || "")}</div>
      <div class="small">Contacto: <span class="mono">${escapeHtml(n.contact || "—")}</span></div>
    </div>
  `;}).join("") : `<div class="muted">No hay necesidades para esos filtros.</div>`;
}

function renderDropoffs(){
  $("#dropoffList").innerHTML = CONFIG.dropoffs.length ? CONFIG.dropoffs.map(d=>`
    <div class="item">
      <div class="top">
        <strong>${escapeHtml(d.name)}</strong>
        <a class="btn" href="${escapeHtml(d.maps||"#")}" target="_blank" rel="noopener">Ver en Maps</a>
      </div>
      <div class="muted">${escapeHtml(d.address||"")}</div>
      <div class="small">Horario: <span class="mono">${escapeHtml(d.hours||"—")}</span></div>
      <div class="small">Contacto: <span class="mono">${escapeHtml(d.contact||"—")}</span></div>
    </div>
  `).join("") : `<div class="muted">Aún no hay puntos de acopio cargados.</div>`;
}

function renderDonations(){
  $("#donationList").innerHTML = CONFIG.donations.length ? CONFIG.donations.map((d,idx)=>`
    <div class="item">
      <div class="top">
        <strong>${escapeHtml(d.org)}</strong>
        <span class="tag ok">Verificado</span>
      </div>

      ${d.titular ? `<div class="muted">${escapeHtml(d.titular)}</div>` : ""}

      <div style="margin-top: 8px; display: grid; gap: 4px;">
        <div class="copyline">
          <div style="flex:1">
            <div class="small"><strong>Alias:</strong> <span class="mono" id="alias_${idx}">${escapeHtml(d.alias||"—")}</span></div>
          </div>
          <button class="btn" data-copy="#alias_${idx}" type="button">Copiar</button>
        </div>
        ${d.cuit ? `<div class="small"><strong>CUIT:</strong> <span class="mono">${escapeHtml(d.cuit)}</span></div>` : ""}
        ${d.contact ? `<div class="small"><strong>Contacto:</strong> <span class="mono">${escapeHtml(d.contact)}</span></div>` : ""}
        ${d.instagram ? `<div class="small"><strong>Instagram:</strong> <a href="https://instagram.com/${escapeHtml(d.instagram.replace('@',''))}" target="_blank" rel="noopener">${escapeHtml(d.instagram)}</a></div>` : ""}
        ${d.note ? `<div class="small" style="color: var(--warn); font-weight: 600;">⚠️ ${escapeHtml(d.note)}</div>` : ""}
      </div>
    </div>
  `).join("") : `<div class="muted">Aún no hay datos de donaciones cargados.</div>`;
}

function renderQuickLinks(){
  $("#quickLinks").innerHTML = CONFIG.quickLinks.map(l=>`
    <div class="item">
      <div class="top">
        <strong>${escapeHtml(l.label)}</strong>
        <a class="btn" href="${escapeHtml(l.href||"#")}">Abrir</a>
      </div>
      <div class="small">${escapeHtml(l.note||"")}</div>
    </div>
  `).join("");
}

function renderEmergency(){
  $("#emergencyContacts").innerHTML = CONFIG.emergencyContacts.map(c=>`
    <div class="item">
      <div class="top">
        <strong>${escapeHtml(c.name)}</strong>
        <a class="btn danger" href="${escapeHtml(c.href||"#")}">${escapeHtml(c.action||"Acción")}</a>
      </div>
      <div class="small mono">${escapeHtml(c.detail||"")}</div>
    </div>
  `).join("");
}

function renderVoluntariados(){
  const list = CONFIG.voluntariados || [];
  if (!list.length) return;

  const colorMap = {
    danger: { bg: 'rgba(255,92,108,.08)', border: 'rgba(255,92,108,.30)', btn: 'danger' },
    ok: { bg: 'rgba(73,213,164,.08)', border: 'rgba(73,213,164,.30)', btn: 'good' },
    need: { bg: 'rgba(255,214,102,.08)', border: 'rgba(255,214,102,.30)', btn: 'primary' },
    default: { bg: 'rgba(255,255,255,.04)', border: 'var(--border)', btn: '' }
  };

  $("#voluntariadosList").innerHTML = list.map((v, idx) => {
    const colors = colorMap[v.tipo] || colorMap.default;

    // Sección de necesidades (formato anterior)
    let necesidadesHtml = '';
    if (v.necesidades && v.necesidades.length) {
      necesidadesHtml = `
        <div class="muted" style="margin-bottom:12px;"><strong>NECESITAMOS:</strong></div>
        <div style="display:grid; gap:10px; margin-bottom:12px;">
          ${v.necesidades.map((n, i) => `
            <div style="padding:10px; background: rgba(255,255,255,.04); border-radius:8px;">
              <div style="font-weight:600; margin-bottom:4px;">${i+1}- ${escapeHtml(n.titulo)}</div>
              <div class="small">${escapeHtml(n.detalle)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Descripción
    let descripcionHtml = v.descripcion ? `<div class="muted" style="margin-bottom:12px;">${escapeHtml(v.descripcion)}</div>` : '';

    // Tareas (nuevo formato)
    let tareasHtml = '';
    if (v.tareas && v.tareas.length) {
      tareasHtml = `
        <div style="margin-bottom:12px;">
          <div class="muted" style="margin-bottom:8px;"><strong>TAREAS:</strong></div>
          <ul style="margin:0 0 0 20px; line-height:1.6;">
            ${v.tareas.map(t => `<li>${escapeHtml(t)}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    // Perfiles buscados (nuevo formato)
    let perfilesHtml = '';
    if (v.perfilesBuscados) {
      perfilesHtml = `
        <div style="margin-bottom:12px; padding:10px; background: rgba(255,255,255,.04); border-radius:8px;">
          <div class="small"><strong>Perfiles buscados:</strong> ${escapeHtml(v.perfilesBuscados)}</div>
        </div>
      `;
    }

    // Contacto (formato anterior con teléfono/whatsapp)
    let contactoHtml = '';
    if (v.coordinacion) {
      contactoHtml += `<div class="small">Coordinación: <strong>${escapeHtml(v.coordinacion)}</strong></div>`;
    }
    if (v.coordinador) {
      contactoHtml += `<div class="small">Coordinador/a: ${escapeHtml(v.coordinador)}</div>`;
    }
    if (v.telefono && v.telefonoDisplay) {
      contactoHtml += `<div class="small">Contacto: <a href="tel:${escapeHtml(v.telefono)}" class="mono" style="color:var(--accent); text-decoration:none;">${escapeHtml(v.telefonoDisplay)}</a></div>`;
    }
    if (v.instagram) {
      const igHandle = v.instagram.replace('https://www.instagram.com/', '').replace('https://instagram.com/', '').replace('/', '');
      contactoHtml += `<div class="small">Instagram: <a href="${escapeHtml(v.instagram)}" target="_blank" rel="noopener" style="color:var(--accent);">@${escapeHtml(igHandle)}</a></div>`;
    }

    // Botón de WhatsApp (si tiene teléfono)
    let waButtonHtml = '';
    if (v.telefono && v.whatsappMensaje) {
      const phoneNumber = (v.telefono || '').replace(/\+/g,'');
      const waLink = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(v.whatsappMensaje)}`;
      waButtonHtml = `
        <a class="btn ${colors.btn}" href="${waLink}" target="_blank" rel="noopener">
          <i class="fa-brands fa-whatsapp"></i> Contactar
        </a>
      `;
    }

    // Formulario de inscripción (nuevo formato)
    let formularioHtml = '';
    if (v.formularioInscripcion) {
      formularioHtml = `
        <a class="btn ${colors.btn}" href="${escapeHtml(v.formularioInscripcion)}" target="_blank" rel="noopener">
          <i class="fa-solid fa-file-pen"></i> ${escapeHtml(v.formularioLabel || 'Inscribirse')}
        </a>
      `;
    }

    const separator = idx < list.length - 1 ? '<div class="hr"></div>' : '';

    return `
      <div class="item" style="background: ${colors.bg}; border-color: ${colors.border};">
        <div class="top">
          <strong>${escapeHtml(v.titulo)}</strong>
          <span class="tag ${v.tipo}">${escapeHtml(v.tipoLabel)}</span>
        </div>
        ${descripcionHtml}
        ${tareasHtml}
        ${perfilesHtml}
        ${necesidadesHtml}
        <div style="margin-top:10px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <div style="flex:1;">
            ${contactoHtml}
          </div>
          ${waButtonHtml}
          ${formularioHtml}
        </div>
      </div>
      ${separator}
    `;
  }).join('');
}

function renderWhatsappGroups(){
  if (!CONFIG.whatsappGroups) return;

  // Descripción
  const descElement = $("#whatsappDescription");
  if (descElement) {
    descElement.textContent = CONFIG.whatsappGroups.description || "";
  }

  // Grupos principales
  const mainGroups = CONFIG.whatsappGroups.mainGroups || [];
  $("#mainWhatsappGroups").innerHTML = mainGroups.map(g=>`
    <div class="item">
      <div class="top">
        <strong>${escapeHtml(g.name)}</strong>
        <a class="btn good" href="${escapeHtml(g.link)}" target="_blank" rel="noopener">Unirse al grupo</a>
      </div>
      <div class="muted">${escapeHtml(g.description||"")}</div>
    </div>
  `).join("");

  // Grupos regionales
  const regionalGroups = CONFIG.whatsappGroups.regionalGroups || [];
  $("#regionalWhatsappGroups").innerHTML = regionalGroups.map(g=>`
    <div class="item">
      <div class="top">
        <strong>Coordinación ${escapeHtml(g.province)}</strong>
        <a class="btn primary" href="${escapeHtml(g.link)}" target="_blank" rel="noopener">Unirse</a>
      </div>
    </div>
  `).join("");
}

function wireCopyButtons(){
  document.addEventListener("click", async (e)=>{
    const btn = e.target.closest("[data-copy]");
    if(!btn) return;
    const sel = btn.getAttribute("data-copy");
    const node = document.querySelector(sel);
    if(!node) return;
    const text = node.textContent.trim();
    try{
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copiado";
      setTimeout(()=> btn.textContent = "Copiar", 900);
    }catch{
      alert("No se pudo copiar. Copiá manualmente: " + text);
    }
  });
}

function wireVolunteer(){
  // Toggle mostrar campo de capacidad cuando selecciona "Sí"
  const accomYes = $("#vAccomYes");
  const accomNo = $("#vAccomNo");
  const capacityContainer = $("#capacityContainer");
  const accomCapacity = $("#vAccomCapacity");

  // Si el formulario está comentado/oculto, no hacer nada
  if (!accomYes || !accomNo) return;

  accomYes.addEventListener("change", ()=>{
    if(accomYes.checked) capacityContainer.style.display = "block";
  });
  accomNo.addEventListener("change", ()=>{
    if(accomNo.checked){
      capacityContainer.style.display = "none";
      accomCapacity.value = "";
    }
  });

  const btnVolunteerMsg = $("#btnVolunteerMsg");
  if (!btnVolunteerMsg) return;

  btnVolunteerMsg.addEventListener("click", ()=>{
    const name = $("#vName").value.trim();
    const age = $("#vAge").value.trim();
    const town = $("#vTown").value.trim();
    const av = $("#vAvailability").value.trim();
    const mob = $("#vMobility").value;
    const experience = $("#vExperience").checked ? "Sí" : "No";

    // Recolectar habilidades marcadas
    const skills = [];
    if($("#vSkillHealth").checked) skills.push("Salud/primeros auxilios");
    if($("#vSkillLogistics").checked) skills.push("Logística");
    if($("#vSkillCooking").checked) skills.push("Cocina/viandas");
    if($("#vSkillConstruction").checked) skills.push("Construcción");
    if($("#vSkillAnimals").checked) skills.push("Cuidado de animales");
    if($("#vSkillTransport").checked) skills.push("Transporte");
    const skillsText = skills.length > 0 ? skills.join(", ") : "—";

    const resources = $("#vSkills").value.trim();

    const canAccommodate = accomYes.checked ? "Sí" : "No";
    const accommodationCapacity = accomYes.checked ? (accomCapacity.value.trim() || "—") : "—";

    let msg = `Hola, me ofrezco como voluntario/a.
Nombre: ${name || "—"}
Edad: ${age || "—"}
Localidad: ${town || "—"}
Disponibilidad: ${av || "—"}
Movilidad: ${mob || "—"}
Experiencia en incendios/emergencias: ${experience}
Habilidades: ${skillsText}`;

    if(resources){
      msg += `\nRecursos/equipamiento: ${resources}`;
    }

    msg += `\n¿Puede alojar voluntarios?: ${canAccommodate}`;
    if(canAccommodate === "Sí"){
      msg += ` (capacidad: ${accommodationCapacity} personas)`;
    }

    msg += `\n\n¿Dónde y con quién me coordino?`;

    $("#volMsgText").textContent = msg;
    $("#volMsgBox").style.display = "block";

    const wa = $("#btnVolunteerWhatsApp");
    const num = CONFIG.volunteerWhatsAppNumber || "";
    if(num){
      const url = `https://wa.me/${encodeURIComponent(num)}?text=${encodeURIComponent(msg)}`;
      wa.href = url;
      wa.style.display = "inline-flex";
    }else{
      wa.style.display = "none";
    }
  });

  const btnCopyVol = $("#btnCopyVol");
  if (!btnCopyVol) return;

  btnCopyVol.addEventListener("click", async ()=>{
    const text = $("#volMsgText").textContent;
    try{
      await navigator.clipboard.writeText(text);
      btnCopyVol.textContent = "Copiado";
      setTimeout(()=> btnCopyVol.textContent = "Copiar", 900);
    }catch{
      alert("No se pudo copiar. Copiá manualmente.");
    }
  });
}

function wireShare(){
  $("#btnShare").addEventListener("click", async ()=>{
    const url = location.href;
    const text = "Incendios Comarca Andina — Info y ayuda (partes, necesidades, acopios, voluntariado).";
    try{
      if(navigator.share){
        await navigator.share({ title: document.title, text, url });
      }else{
        await navigator.clipboard.writeText(url);
        $("#btnShare").textContent = "Link copiado";
        setTimeout(()=> $("#btnShare").textContent = "Compartir", 900);
      }
    }catch{
      // silencio
    }
  });
}


function wireFilters(){
  $("#searchUpdates").addEventListener("input", renderUpdates);
  $("#filterSource").addEventListener("change", renderUpdates);
  $("#filterTown").addEventListener("change", renderNeeds);
  $("#filterCategory").addEventListener("change", renderNeeds);
}

function wireBackToTop(){
  // Crear botón volver arriba
  const btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '↑';
  btn.setAttribute('aria-label', 'Volver arriba');
  btn.title = 'Volver arriba';
  document.body.appendChild(btn);

  // Mostrar/ocultar según scroll
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (window.scrollY > 300) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }, 100);
  });

  // Click para volver arriba
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function enableSmoothScroll(){
  // Scroll suave para todos los enlaces internos
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (href === '#') return;

    const target = document.querySelector(href);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function wireTabs(){
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      // Remover active de todos los tabs
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tabContents.forEach(tc => tc.classList.remove('active'));

      // Activar el tab clickeado
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const targetContent = document.getElementById(`tab-${targetTab}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      // Scroll suave al inicio del contenido
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function wireRegionalGroupsToggle(){
  const toggleBtn = $("#toggleRegionalGroups");
  const container = $("#regionalGroupsContainer");

  if(!toggleBtn || !container) return;

  let isVisible = false;

  toggleBtn.addEventListener("click", () => {
    isVisible = !isVisible;
    container.style.display = isVisible ? "block" : "none";
    toggleBtn.textContent = isVisible ? "Ocultar grupos" : "Mostrar grupos (8)";
  });
}

function wireCtaButtons(){
  // Botón CTA Donar
  $("#btnCtaDonate").addEventListener("click", () => {
    // Activar tab de donaciones
    const donacionesTab = document.querySelector('[data-tab="donaciones"]');
    if(donacionesTab) {
      donacionesTab.click();
    }
  });

  // Botón CTA Voluntariado
  $("#btnCtaVolunteer").addEventListener("click", () => {
    // Activar tab de voluntariado
    const voluntariadoTab = document.querySelector('[data-tab="voluntariado"]');
    if(voluntariadoTab) {
      voluntariadoTab.click();
    }
  });
}

/******************************************************************
 * SERVICIOS PARA VOLUNTARIOS
 ******************************************************************/
async function renderServices(){
  const container = $("#servicesList");
  if(!container) return;

  try {
    const response = await fetchNoCache('services.json');
    if (!response.ok) throw new Error('Error cargando servicios');
    const data = await response.json();

    const html = data.services.map(service => `
      <section class="card service-card">
        <div class="hd">
          <div class="service-icon" style="background: ${service.gradient};">
            <i class="fa-solid ${service.icon}"></i>
          </div>
          <div>
            <h3>${escapeHtml(service.category)}</h3>
          </div>
        </div>
        <div class="bd">
          <div class="list">
            ${service.items.map((item, idx) => `
              <div class="item">
                <div class="top">
                  <strong>${escapeHtml(item.title)}</strong>
                  ${item.status ? `<span class="tag ${getStatusClass(item.status)}">${escapeHtml(item.status)}</span>` : ''}
                </div>
                <div class="muted">${escapeHtml(item.description)}</div>
                ${item.schedule ? `
                  <div class="muted" style="margin-top:8px;">
                    <i class="fa-solid fa-clock"></i> ${escapeHtml(item.schedule)}
                  </div>
                ` : ''}
                ${item.location ? `
                  <div style="margin-top:8px;">
                    ${item.location.url ? `
                      <a href="${escapeHtml(item.location.url)}" target="_blank" rel="noopener" class="btn" style="display:inline-flex; gap:6px; font-size:13px;">
                        <i class="fa-solid fa-map-marker-alt"></i>
                        ${escapeHtml(item.location.label)}
                      </a>
                    ` : `
                      <div class="muted">
                        <i class="fa-solid fa-map-marker-alt"></i> ${escapeHtml(item.location.label)}
                      </div>
                    `}
                  </div>
                ` : ''}
                ${item.contact ? `
                  <div style="margin-top:8px;">
                    <a href="${escapeHtml(item.contact.url)}" target="_blank" rel="noopener" class="btn ${item.contact.type === 'whatsapp' ? 'good' : ''}" style="display:inline-flex; gap:6px; font-size:13px;">
                      <i class="fa-${item.contact.type === 'whatsapp' ? 'brands' : 'solid'} fa-${item.contact.type === 'whatsapp' ? 'whatsapp' : 'phone'}"></i>
                      ${escapeHtml(item.contact.label)}
                    </a>
                  </div>
                ` : ''}
                ${item.note ? `
                  <div class="notice" style="margin-top:12px; font-size:13px;">
                    ${escapeHtml(item.note)}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `).join('');

    container.innerHTML = html;
  } catch (error) {
    console.error('Error al cargar servicios:', error);
    container.innerHTML = '<div class="notice">Error al cargar los servicios. Intenta recargar la página.</div>';
  }
}

function getStatusClass(status) {
  const s = status.toLowerCase();
  if (s.includes('disponible') || s.includes('activo') || s.includes('gratuito')) return 'good';
  if (s.includes('consultar')) return '';
  return 'ok';
}

async function boot(){
  // Cargar configuración primero
  const loaded = await loadConfig();
  if (!loaded) return;

  // Renderizar todo
  renderHeader();
  renderAlert();
  renderKPIs();
  populateFilters();
  renderUpdates();
  renderNeeds();
  renderDropoffs();
  renderDonations();
  renderQuickLinks();
  renderEmergency();
  renderWhatsappGroups();
  renderVoluntariados();
  renderServices();

  wireCopyButtons();
  wireVolunteer();
  wireShare();
  wireFilters();
  wireBackToTop();
  enableSmoothScroll();
  wireTabs();
  wireRegionalGroupsToggle();
  wireCtaButtons();
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
