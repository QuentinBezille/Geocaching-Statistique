const gcColors = {
    "Traditional Cache": "#02874d", "Lab Cache": "#FF9800", "Unknown Cache": "#0057b8", 
    "Multi-cache": "#f99800", "Letterbox Hybrid": "#104169", "Earthcache": "#296a32", 
    "Virtual Cache": "#00aeb3", "Event Cache": "#c10020", "Mega-Event Cache": "#c10020", 
    "Webcam Cache": "#00aeb3", "Wherigo Cache": "#5d3a29", "Cache In Trash Out Event": "#02874d",
    "Locationless (Reverse) Cache": "#555", "Autre": "#888888"
};

const sizeColors = {
    "Micro": "#d1c4e9", "Small": "#b39ddb", "Regular": "#9575cd", 
    "Large": "#7e57c2", "Other": "#5e35b1", "Virtual": "#00aeb3", "Not chosen": "#9e9e9e"
};

const moisNomsFull = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const joursNomsFull = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const moisAbrev = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

let donneesGlobalesJours = {}; 
let donneesMoisJour = {}; 

let gpxStats = null, labStats = null, draftStats = null;
let isPrevisionnel = false;
window.draftDates = {}; // Stocke les dates lues dans le fichier TXT
let chartTypes = null, chartSizes = null, chartCumul = null, chartMonthly = null, fullCalendarInstance = null;
let chartRadarDays = null, chartRadarMonths = null, chart360 = null, leafletMap = null, marker = null;

window.onload = function() {
    // --- Restauration de l'onglet principal actif (navigation par onglets) ---
    let lastTab = null;
    try {
        lastTab = localStorage.getItem('mainTab_actif');
        if (lastTab && MAIN_TABS.includes(lastTab)) {
            MAIN_TABS.forEach(id => {
                const panel = document.getElementById('panel-' + id);
                if (panel) panel.style.display = (id === lastTab) ? 'block' : 'none';
            });
            document.querySelectorAll('.main-tab-btn').forEach((btn, idx) => {
                btn.classList.toggle('active', MAIN_TABS[idx] === lastTab);
            });
        }
    } catch (e) {}

    // --- NOUVEAU : Chargement auto du Pseudo et Domicile ---
    const savedPseudo = localStorage.getItem('userPseudo');
    const savedHome = localStorage.getItem('userHome');
    

    if (savedPseudo) document.getElementById('username').value = savedPseudo;
    if (savedHome) document.getElementById('homeCoords').value = savedHome;
    // -------------------------------------------------------
    if (localStorage.getItem('gpxStats_final_vSEATTLE')) { gpxStats = JSON.parse(localStorage.getItem('gpxStats_final_vSEATTLE')); btnReady('gpxBtn', "✅ GPX en mémoire !"); }
    if (localStorage.getItem('labStats_final_vSEATTLE')) { labStats = JSON.parse(localStorage.getItem('labStats_final_vSEATTLE')); btnReady('csvBtn', "✅ Labs en mémoire !"); }
    if (localStorage.getItem('draftStats_final_vSEATTLE')) { draftStats = JSON.parse(localStorage.getItem('draftStats_final_vSEATTLE')); btnReady('draftBtn', "✅ Brouillons en mémoire !"); }
    
    // NOUVEAU : Chargement du fichier TXT depuis la mémoire
    if (localStorage.getItem('draftTxt_final_vSEATTLE')) { 
        window.draftDates = JSON.parse(localStorage.getItem('draftTxt_final_vSEATTLE')); 
        let btnTxt = document.getElementById('draftTxtBtn');
        if(btnTxt) { btnTxt.innerHTML = "✅ TXT en mémoire !"; btnTxt.style.background = "#d1fae5"; btnTxt.style.color = "#047857"; btnTxt.style.borderColor = "#059669"; }
    }

    let toggleBtn = document.getElementById('togglePrevisionnel');
    if(toggleBtn) {
        toggleBtn.addEventListener('change', (e) => {
            isPrevisionnel = e.target.checked;
            if(gpxStats || labStats || draftStats) compilerEtAfficher();
        });
    }
    if (gpxStats || labStats) compilerEtAfficher();

    // Gestion de la carte Leaflet
    document.getElementById('btnToggleMap').addEventListener('click', () => {
        const mapDiv = document.getElementById('mapContainer');
        if (mapDiv.style.display === 'none') {
            mapDiv.style.display = 'block';
            let coordsObj = parseGeocachingCoords(document.getElementById('homeCoords').value);
            let lat = coordsObj.lat;
            let lon = coordsObj.lon;

            if (!leafletMap) {
                leafletMap = L.map('mapContainer').setView([lat, lon], 10);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(leafletMap);
                marker = L.marker([lat, lon]).addTo(leafletMap);
                
                leafletMap.on('click', function(e) {
                    marker.setLatLng(e.latlng);
                    // Remplissage automatique de la case au format Geocaching
                    let coordsInput = document.getElementById('homeCoords');
                    coordsInput.value = formatGeocachingCoords(e.latlng.lat, e.latlng.lng);
                    // Force la sauvegarde et la mise à jour immédiate du 360 !
                    coordsInput.dispatchEvent(new Event('input')); 
                });
                
            } else {
                leafletMap.setView([lat, lon], 10);
                marker.setLatLng([lat, lon]);
            }
        } else {
            mapDiv.style.display = 'none';
        }
    });
    // Rendre toutes les cartes rétractables au clic sur le titre
    document.querySelectorAll('.card-header').forEach(header => {
        header.addEventListener('click', () => {
            header.parentElement.classList.toggle('collapsed');
        });
    });

    // Recalibre les widgets si l'onglet restauré au chargement est calendar/maps/360
    requestAnimationFrame(() => {
        requestAnimationFrame(() => rafraichirWidgetsOnglet(lastTab || 'overview'));
    });
};
// === SAUVEGARDE AUTO DU PSEUDO ET DOMICILE ===
document.getElementById('username').addEventListener('input', (e) => {
    localStorage.setItem('userPseudo', e.target.value);
});

document.getElementById('homeCoords').addEventListener('input', (e) => {
    localStorage.setItem('userHome', e.target.value);
    // MAGIE : Met à jour le challenge 360 instantanément !
    if (window.lastGeoData) {
        generer360(window.lastGeoData);
    }
});

function btnReady(id, text) { document.getElementById(id).innerHTML = text; document.getElementById(id).classList.add('btn-ready'); }
function viderMemoire() {
    // 1. Confirmation avant de supprimer
    if (!confirm("⚠️ Attention : Cela va supprimer les fichiers GPX/TXT chargés.\n\nTes réglages (Pseudo, Domicile et Dark Mode) seront conservés.\n\nContinuer ?")) {
        return;
    }

    // 2. Liste des clés que nous voulons GARDER (ne pas supprimer)
    // On ajoute 'darkMode' ici, comme ça il n'est jamais touché par le nettoyage
    const keysToPreserve = ['userPseudo', 'userHome', 'darkMode'];

    // 3. Parcourir toutes les clés du localStorage
    // On part de la fin pour éviter les problèmes d'index lors de la suppression
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        
        // 4. Supprimer uniquement si la clé n'est PAS dans notre liste de protection
        if (!keysToPreserve.includes(key)) {
            localStorage.removeItem(key);
        }
    }

    // 5. Ouvrir l'onglet "Vue d'ensemble" au prochain chargement (page d'accueil logique une fois vidé)
    try { localStorage.setItem('mainTab_actif', 'overview'); } catch (e) {}

    // 6. Recharger la page pour remettre le Dashboard à zéro proprement
    location.reload();
}

document.getElementById('gpxInput').addEventListener('change', e => {
    if (!e.target.files[0]) return;
    document.getElementById('gpxBtn').innerHTML = "⏳ Analyse en cours...";
    const reader = new FileReader();
    reader.onload = ev => {
        traiterGPX(ev.target.result);
        switchMainTab('overview'); // Retour à la vue d'ensemble après un (re)chargement de données
    };
    reader.readAsText(e.target.files[0]);
    e.target.value = null; // Permet de recharger le même fichier
});

document.getElementById('csvInput').addEventListener('change', e => {
    if (!e.target.files[0]) return;
    document.getElementById('csvBtn').innerHTML = "⏳ Analyse en cours...";
    const reader = new FileReader();
    reader.onload = ev => traiterLabs(ev.target.result);
    reader.readAsText(e.target.files[0]);
    e.target.value = null; // Permet de recharger le même fichier
});

// === OUTIL DE NETTOYAGE EXTRÊME (Enlève accents, espaces, ponctuation) ===
function cleanName(str) {
    if(!str) return "";
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// === FONCTION DE NETTOYAGE AUTOMATIQUE (Brouillons & Project-GC) ===
function nettoyerTexteGeocaching(texteBrut) {
    let lignes = texteBrut.split('\n').map(l => l.trim());
    let textePropre = "";
    
    for (let i = 0; i < lignes.length; i++) {
        let ligne = lignes[i];
        if (!ligne) continue;

        // --- CAS 1 : TABLEAU PROJECT-GC LAB CACHES ---
        let matchPGC = ligne.match(/^\d+[\t\s]+(\d{4}-\d{2}-\d{2})[\t\s]+(.+?)[\t\s]+\d+$/);
        if (matchPGC) {
            let parts = matchPGC[1].split('-');
            // Conversion YYYY-MM-DD en DD/MM/YYYY
            textePropre += `Found it: ${parts[2]}/${parts[1]}/${parts[0]}\n${matchPGC[2].trim()}\n\n`;
            continue;
        }

        // --- CAS 2 : COPIER-COLLER GEOCACHING.COM (Brouillons bruts) ---
        let matchTypeDate = ligne.match(/^(Found it|Write note|Didn't find it|Disable|Archive|Needs Maintenance|Webcam Photo Taken|Attended):\s*(\d{2}\/\d{2}\/\d{4})/i);
        
        if (matchTypeDate) {
            // Sous-cas A : Le nom de la cache est sur la ligne DU DESSUS (Format brut Geocaching)
            if (i > 0 && lignes[i-1] && !lignes[i-1].match(/^(Found it|Write note|Didn't find it|Disable|Archive|Needs Maintenance)/i)) {
                textePropre += `${matchTypeDate[0]}\n${lignes[i-1]}\n\n`;
            } 
            // Sous-cas B : Le nom de la cache est sur la ligne DU DESSOUS (Texte déjà propre)
            else if (i + 1 < lignes.length && lignes[i+1] && !lignes[i+1].match(/^(Found it|Write note|Didn't find it|Disable|Archive|Needs Maintenance)/i)) {
                textePropre += `${matchTypeDate[0]}\n${lignes[i+1]}\n\n`;
            }
        }
    }
    
    // Si le nettoyage n'a rien trouvé, on retourne le texte original par sécurité
    return textePropre.trim() !== "" ? textePropre.trim() : texteBrut.trim();
}

// === LECTEUR DU FICHIER TXT (Brouillons & Project-GC avec Nettoyage Auto) ===
document.getElementById('draftTxtInput').addEventListener('change', e => {
    if (!e.target.files[0]) return;
    
    // NOUVEAU : Affiche "Analyse en cours..." comme pour les autres boutons
    document.getElementById('draftTxtBtn').innerHTML = "⏳ Analyse en cours...";
    
    const reader = new FileReader();
    reader.onload = ev => {
        window.draftDates = {};
        
        // 🪄 LA MAGIE EST ICI : On passe le texte brut dans ton nettoyeur automatique !
        let textePropre = nettoyerTexteGeocaching(ev.target.result);
        
        // On utilise le texte nettoyé pour la suite de l'analyse
        const lines = textePropre.split('\n');
        let pendingDate = null, matchCount = 0;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line === "") continue;

            if (line.startsWith("Found it:") || line.startsWith("Attended:") || line.startsWith("Webcam Photo Taken:")) {
                let parts = line.split(':');
                if (parts.length > 1) {
                    let dParts = parts[1].trim().split('/');
                    if (dParts.length === 3) pendingDate = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
                }
            } 
            else if (line.startsWith("Didn't find it:") || line.startsWith("Write note:") || line.startsWith("Disable:")) {
                pendingDate = null; 
            } 
            else if (pendingDate !== null) {
                // Application du nettoyage extrême sur le nom de la cache
                let safeName = cleanName(line.replace(/\.\.\.$/, ''));
                window.draftDates[safeName] = pendingDate;
                matchCount++;
                pendingDate = null;
            }
        }
        
        document.getElementById('draftStatus').innerText = `✅ ${matchCount} vraies trouvailles détectées ! Chargez vite le GPX.`;
        localStorage.setItem('draftTxt_final_vSEATTLE', JSON.stringify(window.draftDates));
        
        // NOUVEAU : On transforme le bouton en vert "Chargé !" comme pour les Labs
        btnReady('draftTxtBtn', "✅ TXT Chargé !");
    };
    reader.readAsText(e.target.files[0]);
    e.target.value = null; // Permet de recharger le même fichier
});

document.getElementById('draftInput').addEventListener('change', e => {
    if (!e.target.files[0]) return;
    document.getElementById('draftBtn').innerHTML = "⏳ Analyse en cours...";
    const reader = new FileReader();
    reader.onload = ev => traiterGPX(ev.target.result, true); // Le "true" active la magie du prévisionnel
    reader.readAsText(e.target.files[0]);
    e.target.value = null; // Permet de recharger le même fichier
});

// === CONVERTISSEUR DE FUSEAU HORAIRE SEATTLE (MOTEUR GEOCACHING OFFICIEL) ===
function getGeocachingDate(utcDateStr) {
    const dt = new Date(utcDateStr);
    if (isNaN(dt.getTime())) return null;

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    return formatter.format(dt);
}

// === GESTION DES COORDONNÉES GEOCACHING (Format N 48° 01.366 E 002° 26.806) ===
function parseGeocachingCoords(coordsStr) {
    const regex = /([NS])\s*(\d+)°?\s*(\d+\.?\d*)[^\dEOW]*([EOW])\s*(\d+)°?\s*(\d+\.?\d*)/i;
    const match = coordsStr.match(regex);
    if (match) {
        let lat = parseInt(match[2], 10) + (parseFloat(match[3]) / 60);
        if (match[1].toUpperCase() === 'S') lat = -lat;
        let lon = parseInt(match[5], 10) + (parseFloat(match[6]) / 60);
        let lonDir = match[4].toUpperCase();
        if (lonDir === 'W' || lonDir === 'O') lon = -lon;
        return { lat: lat, lon: lon };
    }
    return { lat: 48.0167, lon: 2.4833 }; 
}

function formatGeocachingCoords(lat, lon) {
    const formatDDM = (coord, isLat) => {
        const dir = coord >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
        const absCoord = Math.abs(coord);
        const deg = Math.floor(absCoord);
        const min = ((absCoord - deg) * 60).toFixed(3);
        return `${dir} ${String(deg).padStart(isLat ? 2 : 3, '0')}° ${String(min).padStart(6, '0')}`;
    };
    return `${formatDDM(lat, true)} ${formatDDM(lon, false)}`;
}

// === MOTEUR D'EXTRACTION TOTALEMENT SÉCURISÉ (GPX & BROUILLONS) ===
function traiterGPX(xmlString, isDraft = false) {
    try {
        const pseudo = document.getElementById('username').value.trim().toLowerCase();
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlString, "text/xml");
        const wpts = xml.getElementsByTagName("wpt");
        
        let tGpx = { types: {}, sizes: {}, dt: {}, days: {}, geo: [], ftfCount: 0, ftfList: [], count: 0 };
        const dToday = new Date();
        const todayStr = dToday.getFullYear() + "-" + String(dToday.getMonth()+1).padStart(2,'0') + "-" + String(dToday.getDate()).padStart(2,'0');

        let pendingDrafts = {};
        if (isDraft && window.draftDates) {
            pendingDrafts = Object.assign({}, window.draftDates);
        }

        for (let wpt of wpts) {
            const cache = wpt.getElementsByTagNameNS("*", "cache")[0];
            if (!cache) continue;
            
            const type = cache.getElementsByTagNameNS("*", "type")[0]?.textContent || "Autre";
            const size = cache.getElementsByTagNameNS("*", "container")[0]?.textContent || "Not chosen";
            
            const diffRaw = cache.getElementsByTagNameNS("*", "difficulty")[0]?.textContent || "1";
            const terrRaw = cache.getElementsByTagNameNS("*", "terrain")[0]?.textContent || "1";
            const dtKey = `${parseFloat(diffRaw)}/${parseFloat(terrRaw)}`;
            const cacheName = cache.getElementsByTagNameNS("*", "name")[0]?.textContent || "Cache Inconnue";
            const country = cache.getElementsByTagNameNS("*", "country")[0]?.textContent || "Inconnu";
            let state = cache.getElementsByTagNameNS("*", "state")[0]?.textContent || "Inconnue";
            const gcCode = wpt.getElementsByTagNameNS("*", "name")[0]?.textContent || "";
            const lat = parseFloat(wpt.getAttribute("lat"));
            const lon = parseFloat(wpt.getAttribute("lon"));

            // FALLBACK GÉOGRAPHIQUE : Geocaching.com laisse souvent le champ "state/province" vide
            // dans le GPX. Quand c'est le cas (France/Belgique uniquement pour l'instant), on devine
            // la région à partir des coordonnées GPS plutôt que de perdre la cache en "Inconnue".
            if (state === "Inconnue" && !isNaN(lat) && !isNaN(lon)) {
                let deduite = devinerRegionParCoords(country, lat, lon);
                if (deduite) state = deduite;
            }
            
            let countLogTrouve = 0;

            if (isDraft) {
                // === MAGIE DE LA FUSION AVEC NETTOYAGE EXTRÊME ===
                let gpxNameClean = cleanName(cacheName);
                let matchedDate = null;
                let matchedKey = null;

                if (pendingDrafts[gpxNameClean]) {
                    matchedDate = pendingDrafts[gpxNameClean];
                    matchedKey = gpxNameClean;
                } else {
                    for (let draftName in pendingDrafts) {
                        if (draftName.length > 5 && gpxNameClean.startsWith(draftName)) {
                            matchedDate = pendingDrafts[draftName];
                            matchedKey = draftName;
                            break;
                        }
                    }
                }

                if (matchedDate) {
                    countLogTrouve = 1;
                    if (!tGpx.days[matchedDate]) tGpx.days[matchedDate] = { total: 0, physiques: 0, typesDetail: {} };
                    tGpx.days[matchedDate].total++;
                    tGpx.days[matchedDate].physiques++;
                    tGpx.days[matchedDate].typesDetail[type] = (tGpx.days[matchedDate].typesDetail[type] || 0) + 1;
                    
                    delete pendingDrafts[matchedKey]; 
                } else if (!window.draftDates || Object.keys(window.draftDates).length === 0) {
                    countLogTrouve = 1;
                    if (!tGpx.days[todayStr]) tGpx.days[todayStr] = { total: 0, physiques: 0, typesDetail: {} };
                    tGpx.days[todayStr].total++;
                    tGpx.days[todayStr].physiques++;
                    tGpx.days[todayStr].typesDetail[type] = (tGpx.days[todayStr].typesDetail[type] || 0) + 1;
                }
            } else {
                // === LECTURE NORMALE ET DÉTECTION FTF OUBLIÉS ===
                let validLogs = [];
                const logs = wpt.getElementsByTagNameNS("*", "log");
                let userLogInfo = null;
                let hasPublishLog = false;
                let hasOtherPlayers = false;

                for (let i = 0; i < logs.length; i++) {
                    const logType = logs[i].getElementsByTagNameNS("*", "type")[0]?.textContent || "";
                    
                    // 1. OBLIGATOIRE : Ignorer le log du Reviewer (ex: miguaine)
                    if (logType === "Publish Listing") {
                        hasPublishLog = true;
                        continue; 
                    }

                    const finderNode = logs[i].getElementsByTagNameNS("*", "finder")[0];
                    const finder = finderNode ? finderNode.textContent.trim().toLowerCase() : "";
                    const lDateStr = logs[i].getElementsByTagNameNS("*", "date")[0]?.textContent;
                    const logText = logs[i].getElementsByTagNameNS("*", "text")[0]?.textContent || "";
                    const logId = parseInt(logs[i].getAttribute("id") || "0", 10); // L'ID donne l'ordre chronologique !

                    if (finder !== "" && finder !== pseudo) hasOtherPlayers = true;

                    // 2. Chercher les logs valides : Found it ou Write note avec FTF
                    const isFound = ["found it", "attended", "webcam photo taken"].includes(logType.toLowerCase());
                    const isWriteNoteFTF = (logType.toLowerCase() === "write note" && /ftf/i.test(logText));

                    if (isFound || isWriteNoteFTF) {
                        if (lDateStr) {
                            const dateCourte = getGeocachingDate(lDateStr);
                            if (dateCourte) {
                                validLogs.push({ finder: finder, date: dateCourte, id: logId, text: logText, isFound: isFound });
                                if (finder === pseudo && isFound) {
                                    userLogInfo = { date: dateCourte, text: logText };
                                }
                            }
                        }
                    }
                }

                // 3. Traitement si c'est une de mes caches trouvées
                if (userLogInfo) {
                    const dateCourte = userLogInfo.date;
                    const logText = userLogInfo.text;
                    const isFTF = /\{\*FTF\*\}|\{FTF\}|\[FTF\]/i.test(logText);

                    if (!tGpx.days[dateCourte]) tGpx.days[dateCourte] = { total: 0, physiques: 0, typesDetail: {} };
                    tGpx.days[dateCourte].total++;
                    tGpx.days[dateCourte].physiques++;
                    tGpx.days[dateCourte].typesDetail[type] = (tGpx.days[dateCourte].typesDetail[type] || 0) + 1;
                    countLogTrouve++;

                    if (!tGpx.missedFtfList) tGpx.missedFtfList = [];

                    // --- SAUVEGARDE DE LA CACHE POUR LES JALONS ---
                    if (!tGpx.allFinds) tGpx.allFinds = [];
                    tGpx.allFinds.push({
                        date: dateCourte,
                        logId: userLogInfo.id, // Utilisé pour trier chronologiquement le même jour
                        gcCode: gcCode,
                        name: cacheName,
                        type: type,
                        country: country,
                        state: state
                    });

                    if (isFTF) {
                        tGpx.ftfCount++;
                        tGpx.ftfList.push({ 
                            date: dateCourte, 
                            name: cacheName, 
                            gcCode: gcCode,
                            lat: lat, 
                            lon: lon, 
                            d: parseFloat(diffRaw), 
                            t: parseFloat(terrRaw),
                            type: type, 
                            size: size, /* NOUVEAU : Sauvegarde de la taille */
                            country: country, 
                            state: state
                        });
                    } else {
                        // --- LE MOTEUR DE DÉTECTION DES OUBLIS ---
                        // On trie tous les logs valides par Date, puis par ID (chronologie absolue de Geocaching.com)
                        validLogs.sort((a, b) => {
                            let d1 = new Date(a.date).getTime();
                            let d2 = new Date(b.date).getTime();
                            if (d1 !== d2) return d1 - d2;
                            return a.id - b.id; 
                        });

                        // Sécurité anti faux-positifs : Si je suis LE PREMIER de la liste triée
                        // ET qu'il y a la preuve que c'est un historique complet (présence d'autres joueurs ou du reviewer)
                        if (validLogs.length > 0 && validLogs[0].finder === pseudo) {
                            if (hasPublishLog || hasOtherPlayers) {
                                tGpx.missedFtfList.push({ date: dateCourte, name: cacheName, gcCode: gcCode });
                            }
                        }
                    }
                }
            }

            // Assemblage
            if (countLogTrouve > 0) {
                tGpx.count += countLogTrouve;
                

                tGpx.types[type] = (tGpx.types[type] || 0) + countLogTrouve;
                tGpx.sizes[size] = (tGpx.sizes[size] || 0) + countLogTrouve;

                
                if (!tGpx.dt[dtKey]) tGpx.dt[dtKey] = { count: 0, types: {} };
                tGpx.dt[dtKey].count += countLogTrouve;
                tGpx.dt[dtKey].types[type] = (tGpx.dt[dtKey].types[type] || 0) + countLogTrouve;
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    tGpx.geo.push({lat: lat, lon: lon, count: countLogTrouve, gcCode: gcCode, country: country, type: type});
                }
                // NOUVEAU : Comptage géographique dynamique pour Google Charts
                if (!tGpx.locations) tGpx.locations = {};
                if (!tGpx.locations[country]) tGpx.locations[country] = { count: 0, states: {}, types: {} };
                tGpx.locations[country].count += countLogTrouve;
                tGpx.locations[country].types[type] = (tGpx.locations[country].types[type] || 0) + countLogTrouve;
                if (!tGpx.locations[country].states[state]) tGpx.locations[country].states[state] = { count: 0, types: {} };
                if (typeof tGpx.locations[country].states[state] === 'number') {
                    // Migration: convertir l'ancien format nombre en objet
                    tGpx.locations[country].states[state] = { count: tGpx.locations[country].states[state], types: {} };
                }
                tGpx.locations[country].states[state].count += countLogTrouve;
                tGpx.locations[country].states[state].types[type] = (tGpx.locations[country].states[state].types[type] || 0) + countLogTrouve;

            }
        }

        // =========================================================================
        // GESTION DES VRAIES CACHES FANTÔMES (Les disparues de ton GPX)
        // =========================================================================
        let phantomCount = 0; 
        if (isDraft && pendingDrafts) {
            for (let phantomName in pendingDrafts) {
                let phantomDate = pendingDrafts[phantomName];
                phantomCount++; 
                tGpx.count++; 
                
                tGpx.types["Autre"] = (tGpx.types["Autre"] || 0) + 1;
                tGpx.sizes["Not chosen"] = (tGpx.sizes["Not chosen"] || 0) + 1;
                
                if (!tGpx.days[phantomDate]) tGpx.days[phantomDate] = { total: 0, physiques: 0, typesDetail: {} };
                tGpx.days[phantomDate].total++;
                tGpx.days[phantomDate].physiques++;
                tGpx.days[phantomDate].typesDetail["Autre"] = (tGpx.days[phantomDate].typesDetail["Autre"] || 0) + 1;
            }
        }

        // === SAUVEGARDE ET AFFICHAGE DU RÉSULTAT ===
        if (isDraft) {
            draftStats = tGpx;
            localStorage.setItem('draftStats_final_vSEATTLE', JSON.stringify(draftStats));
            
            // Un message plus clair et naturel
            let messageStatus = phantomCount > 0 
                ? `⚠️ Fusion : ${tGpx.count - phantomCount} matchées, ${phantomCount} fantômes !` 
                : `✅ Fusion réussie : ${tGpx.count} caches ajoutées !`;
                
            // Le bouton garde une taille normale, le détail va en dessous
            btnReady('draftBtn', "✅ GPX Fusionné !");
            if(document.getElementById('draftStatus')) document.getElementById('draftStatus').innerText = messageStatus;
            
            let toggle = document.getElementById('togglePrevisionnel');
            if(toggle) toggle.checked = true;
            isPrevisionnel = true;
        } else {
            gpxStats = tGpx;
            localStorage.setItem('gpxStats_final_vSEATTLE', JSON.stringify(gpxStats));
            btnReady('gpxBtn', "✅ GPX Chargé !");
        }
        
        compilerEtAfficher();
    } catch (e) { alert("Erreur Fichier GPX : " + e.message); }
}

// === LECTURE INFAILLIBLE DES LAB CACHES ===
function traiterLabs(texte) {
    try {
        let tLabs = { total: 0, days: {} };
        const lignes = texte.split('\n');

        for (let ligne of lignes) {
            if (ligne.trim() === '') continue;
            const match = ligne.match(/(20\d{2}-\d{2}-\d{2})/);
            if (match) {
                const date = match[1];
                tLabs.days[date] = (tLabs.days[date] || 0) + 1;
                tLabs.total++;
            }
        }

        labStats = tLabs;
        localStorage.setItem('labStats_final_vSEATTLE', JSON.stringify(labStats));
        btnReady('csvBtn', "✅ Labs Chargées !");
        compilerEtAfficher();
    } catch(e) { alert("Erreur Labs : " + e.message); }
}

// === MOTEUR MATHEMATIQUE ===
function dayPlusOne(dateStr) {
    let parts = dateStr.split('-');
    let d = new Date(Date.UTC(parts[0], parts[1]-1, parts[2]));
    d.setUTCDate(d.getUTCDate() + 1);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth()+1).padStart(2,'0') + "-" + String(d.getUTCDate()).padStart(2,'0');
}

function diffDays(d1Str, d2Str) {
    let d1 = new Date(d1Str + "T12:00:00Z");
    let d2 = new Date(d2Str + "T12:00:00Z");
    return Math.round((d2 - d1) / 86400000);
}

function calculerRecords(daysData, totalGlobal) {
    const dates = Object.keys(daysData).sort();
    if (dates.length === 0) return null;

    let firstDate = dates[0];
    const formatterToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
    let today = formatterToday.format(new Date());
    
    let maxStreak = 0, currentStreak = 0, streakStart = "", maxStreakStart = "", maxStreakEnd = "";
    let maxSlump = 0, currentSlump = 0, slumpStart = "", maxSlumpStart = "", maxSlumpEnd = "";

    let curDate = firstDate;
    let daysOfWeekFound = [0,0,0,0,0,0,0]; 
    let monthsFoundCount = new Array(12).fill(0);

    while(curDate <= today) {
        if(daysData[curDate]) {
            if(currentStreak === 0) streakStart = curDate;
            currentStreak++;
            if(currentStreak > maxStreak) { maxStreak = currentStreak; maxStreakStart = streakStart; maxStreakEnd = curDate; }
            
            if (currentSlump > 0) {
                if (currentSlump > maxSlump) {
                    maxSlump = currentSlump;
                    maxSlumpStart = slumpStart;
                    let sEnd = new Date(curDate + "T12:00:00Z");
                    sEnd.setUTCDate(sEnd.getUTCDate() - 1);
                    maxSlumpEnd = sEnd.toISOString().substring(0, 10);
                }
                currentSlump = 0;
            }
        } else {
            if(currentSlump === 0) slumpStart = curDate;
            currentSlump++;
            
            if (currentSlump > maxSlump) {
                maxSlump = currentSlump;
                maxSlumpStart = slumpStart;
                maxSlumpEnd = curDate;
            }
            currentStreak = 0;
        }
        curDate = dayPlusOne(curDate);
    }

    let bestDay = { d: dates[0], c: 0 };
    let months = {}, years = {};

    dates.forEach(d => {
        let count = daysData[d].total;
        if (count > bestDay.c) { bestDay.c = count; bestDay.d = d; }
        
        let parts = d.split('-');
        let dateObj = new Date(Date.UTC(parts[0], parts[1]-1, parts[2]));
        daysOfWeekFound[dateObj.getUTCDay()] += count;
        monthsFoundCount[dateObj.getUTCMonth()] += count;

        let month = d.substring(0, 7);
        let year = d.substring(0, 4);
        months[month] = (months[month] || 0) + count;
        years[year] = (years[year] || 0) + count;
    });

    let bestMonth = { m: "-", c: 0 }, bestYear = { y: "-", c: 0 };
    for (let m in months) { if (months[m] > bestMonth.c) { bestMonth.c = months[m]; bestMonth.m = moisNomsFull[parseInt(m.substring(5,7))-1] + " de " + m.substring(0,4); } }
    for (let y in years) { if (years[y] > bestYear.c) { bestYear.c = years[y]; bestYear.y = y; } }

    let totalDaysCalculated = diffDays(firstDate, today) + 1;
    let rate = (totalGlobal / totalDaysCalculated).toFixed(3);
    
    const fFR = (d) => d ? d.split('-').reverse().join('/') : "";

    let topDow = joursNomsFull[daysOfWeekFound.indexOf(Math.max(...daysOfWeekFound))];
    let topMonthName = moisNomsFull[monthsFoundCount.indexOf(Math.max(...monthsFoundCount))];

    return { 
        firstDateStr: fFR(firstDate), topDow, topMonthName,
        maxStreak, strStreak: maxStreak > 0 ? `du ${fFR(maxStreakStart)} au ${fFR(maxStreakEnd)}` : "-",
        maxSlump, strSlump: maxSlump > 0 ? `du ${fFR(maxSlumpStart)} au ${fFR(maxSlumpEnd)}` : "-",
        rate, currentStreak, currentSlump, lastActiveDate: fFR(dates[dates.length - 1]),
        bestDay: { d: fFR(bestDay.d), c: bestDay.c }, bestMonth, bestYear, monthsData: months, yearsData: years,
        todayPT: today
    };
}

function compilerEtAfficher() {
    const pseudo = document.getElementById('username').value.trim();
    const coords = document.getElementById('homeCoords').value.trim();

    // SÉCURITÉ : Bloquer si les champs sont vides
    if (pseudo === "" || coords === "") {
        document.getElementById('dashboard').style.display = 'none';
        alert("⚠️ Dashboard en attente :\nVeuillez remplir votre Pseudo et vos Coordonnées Domicile dans le panneau de contrôle pour démarrer.");
        return;
    }
    let fs = { totaux: { physiques: 0, labs: 0, global: 0 }, types: {}, sizes: {}, dt: {}, days: {}, geo: [], ftfList: [], missedFtfList: [], allFinds: [], locations: {} };
    
    let sources = [];
    if (gpxStats) sources.push(gpxStats);
    if (isPrevisionnel && draftStats) sources.push(draftStats);

    sources.forEach(src => {
        
        fs.totaux.physiques += src.count;
        fs.totaux.global += src.count;
        for(let t in src.types) fs.types[t] = (fs.types[t] || 0) + src.types[t];
        for(let s in src.sizes) fs.sizes[s] = (fs.sizes[s] || 0) + src.sizes[s];
        
        for(let d in src.dt) { 
            if (!fs.dt[d]) fs.dt[d] = { count: 0, types: {} };
            fs.dt[d].count += src.dt[d].count;
            for(let type in src.dt[d].types) {
                fs.dt[d].types[type] = (fs.dt[d].types[type] || 0) + src.dt[d].types[type];
            }
        }
        // AJOUTER LA FUSION DES LOCATIONS ICI :
        if (src.locations) {
            for (let country in src.locations) {
                if (!fs.locations[country]) fs.locations[country] = { count: 0, states: {}, types: {} };
                fs.locations[country].count += src.locations[country].count;
                // Fusion des types par pays
                if (src.locations[country].types) {
                    for (let t in src.locations[country].types) {
                        fs.locations[country].types[t] = (fs.locations[country].types[t] || 0) + src.locations[country].types[t];
                    }
                }
                for (let state in src.locations[country].states) {
                    let srcState = src.locations[country].states[state];
                    // Support ancien format (nombre) et nouveau format (objet)
                    if (typeof srcState === 'number') {
                        if (!fs.locations[country].states[state]) fs.locations[country].states[state] = { count: 0, types: {} };
                        fs.locations[country].states[state].count += srcState;
                    } else {
                        if (!fs.locations[country].states[state]) fs.locations[country].states[state] = { count: 0, types: {} };
                        fs.locations[country].states[state].count += srcState.count || 0;
                        for (let t in (srcState.types || {})) {
                            fs.locations[country].states[state].types[t] = (fs.locations[country].states[state].types[t] || 0) + srcState.types[t];
                        }
                    }
                }
            }
        }
        
        if (src.geo) fs.geo = fs.geo.concat(src.geo);
        if (src.ftfList) fs.ftfList = fs.ftfList.concat(src.ftfList);
        if (src.missedFtfList) fs.missedFtfList = fs.missedFtfList.concat(src.missedFtfList); // <-- AJOUTE CECI ICI
        if (src.allFinds) fs.allFinds = (fs.allFinds || []).concat(src.allFinds);
        
        for(let date in src.days) {
            if (!fs.days[date]) fs.days[date] = { physiques: 0, labs: 0, total: 0, typesDetail: {} };
            fs.days[date].physiques += src.days[date].physiques;
            fs.days[date].total += src.days[date].total;
            for(let type in src.days[date].typesDetail) {
                fs.days[date].typesDetail[type] = (fs.days[date].typesDetail[type] || 0) + src.days[date].typesDetail[type];
            }
        }
    });

    if (labStats) {
        fs.totaux.labs = labStats.total;
        fs.totaux.global += labStats.total;
        fs.types["Lab Cache"] = labStats.total;

        for(let date in labStats.days) {
            if (!fs.days[date]) fs.days[date] = { physiques: 0, labs: 0, total: 0, typesDetail: {} };
            fs.days[date].labs += labStats.days[date];
            fs.days[date].total += labStats.days[date];
            fs.days[date].typesDetail["Lab Cache"] = (fs.days[date].typesDetail["Lab Cache"] || 0) + labStats.days[date];
        }
    }

    donneesGlobalesJours = fs.days;
    document.getElementById('dashboard').style.display = 'grid';

    let records = calculerRecords(fs.days, fs.totaux.global);
    if(records) {
        document.getElementById('summaryText').innerHTML = `<div>Vous avez trouvé <strong>${fs.totaux.global} cache(s)</strong> depuis votre première découverte le <strong>${records.firstDateStr}</strong>.<br>Vous trouvez le plus de caches en <strong>${records.topMonthName}</strong> et le plus souvent le <strong>${records.topDow}</strong>.</div>`;

        document.getElementById('kpiTotal').innerText = fs.totaux.global;
        document.getElementById('kpiPhysiques').innerText = fs.totaux.physiques;
        document.getElementById('kpiLabs').innerText = fs.totaux.labs;
        document.getElementById('kpiRate').innerText = records.rate;
        document.getElementById('kpiMaxStreak').innerText = records.maxStreak;
        document.getElementById('kpiMaxStreakStr').innerText = "jours consécutifs avec découvertes " + records.strStreak;
        document.getElementById('kpiSlump').innerText = records.maxSlump;
        document.getElementById('kpiSlumpStr').innerText = "jours consécutifs sans découverte " + records.strSlump;
        
        if (records.currentStreak > 0) {
            document.getElementById('kpiCurrent').innerText = records.currentStreak + " j";
            document.getElementById('kpiCurrentStr').innerText = "Série en cours";
        } else {
            document.getElementById('kpiCurrent').innerText = records.currentSlump + " j";
            document.getElementById('kpiCurrentStr').innerText = "Inactif depuis le " + records.lastActiveDate;
        }

        document.getElementById('kpiBestDay').innerText = records.bestDay.c + " caches";
        document.getElementById('kpiBestDayDate').innerText = "le " + records.bestDay.d;
        document.getElementById('kpiBestMonth').innerText = records.bestMonth.c + " caches";
        document.getElementById('kpiBestMonthDate').innerText = "en " + records.bestMonth.m;
        document.getElementById('kpiBestYear').innerText = records.bestYear.c + " caches";
        document.getElementById('kpiBestYearDate').innerText = "en " + records.bestYear.y;

        genererGrapheMoisEtCumul(records.monthsData);
        genererTableAnnuelle(records.yearsData, records.firstDateStr, records.todayPT);
        genererFTFList(fs.ftfList);
        genererMissedFTFList(fs.missedFtfList); // <-- AJOUTE CECI ICI
        if (fs.geo && fs.geo.length > 0) { 
            window.lastGeoData = fs.geo; // On sauvegarde les données pour le curseur
            generer360(fs.geo); 
        }
        genererPaliers(fs.allFinds);
        genererRadarHabitudes(fs.days);
    }

    genererGrille366(fs.days);
    genererMatrice(fs.dt); 
    genererGraphesTypes(fs);
    genererTop50(fs.days);
    genererAgenda(fs.days);

    // Cartes géo dynamiques
    window.lastLocationsData = fs.locations;
    window.lastFtfList = fs.ftfList;
    appellerQuandGooglePret(() => {
        initCartesDynamiques(fs.locations);
        if (isMainPanelVisible('maps')) {
            dessinerCarteFTFDynamique(fs.ftfList);
        }
    });

    // NOUVEAU : Force la mise à jour des couleurs des graphiques fraîchement créés
    applyTheme(document.body.classList.contains('dark-mode'));
}

// === BARRE DE RECHERCHE ===
function rechercherJour() {
    const inputDate = document.getElementById('searchDate').value;
    if (!inputDate) return;
    if (donneesGlobalesJours[inputDate]) { ouvrirModal(inputDate); } 
    else { alert("Aucune cache trouvée à cette date : " + inputDate.split('-').reverse().join('/')); }
}

// === GRAPHIQUES MENSUELS ET CUMULATIFS ===
function genererGrapheMoisEtCumul(monthsData) {
    const moisTries = Object.keys(monthsData).sort();
    if (moisTries.length === 0) return;

    let labels = [], dataMois = [], dataCumul = [], cumul = 0;
    let startParts = moisTries[0].split('-');
    let endParts = moisTries[moisTries.length - 1].split('-');
    let start = new Date(Date.UTC(startParts[0], startParts[1]-1, 1));
    let end = new Date(Date.UTC(endParts[0], endParts[1]-1, 1));

    while (start <= end) {
        let mStr = start.getUTCFullYear() + "-" + String(start.getUTCMonth() + 1).padStart(2, '0');
        labels.push((start.getUTCMonth()+1) + "/" + start.getUTCFullYear());
        let val = monthsData[mStr] || 0;
        dataMois.push(val);
        cumul += val;
        dataCumul.push(cumul);
        start.setUTCMonth(start.getUTCMonth() + 1);
    }

    let canvasMonthly = document.getElementById('monthlyChart');
    if (canvasMonthly) {
        let existingChart = Chart.getChart(canvasMonthly);
        if (existingChart) existingChart.destroy();
        
        new Chart(canvasMonthly.getContext('2d'), {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Découvertes par mois', data: dataMois, backgroundColor: '#059669', borderRadius: 4 }] },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: function(ctx) { return `📦 ${ctx.raw} caches`; } } } },
                animation: {
                    onComplete: function() {
                        const ctx = this.ctx;
                        ctx.font = "bold 11px Arial";
                        ctx.fillStyle = document.body.classList.contains('dark-mode') ? "#ffffff" : "#475569";
                        ctx.textBaseline = "bottom";
                        this.data.datasets.forEach((dataset, i) => {
                            const meta = this.getDatasetMeta(i); 
                            meta.data.forEach((bar, index) => {
                                const data = dataset.data[index];
                                if(data > 0) { ctx.fillText(data, bar.x, bar.y - 5); }
                            });
                        });
                    }
                }
            }
        });
    }

    let canvasCumul = document.getElementById('cumulativeChart');
    if (canvasCumul) {
        let existingCumul = Chart.getChart(canvasCumul);
        if (existingCumul) existingCumul.destroy();
        
        new Chart(canvasCumul.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: [{ label: 'Caches cumulées', data: dataCumul, borderColor: '#02874d', backgroundColor: 'rgba(2, 135, 77, 0.15)', fill: true, tension: 0.1 }] },
            options: { responsive: true, maintainAspectRatio: false, elements: { point: { radius: 1 } }, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }
}

// === TABLEAU ANNUEL ===
function genererTableAnnuelle(yearsData, firstDateStr, todayPTStr) {
    let html = '<tr><th>Année</th><th>Nombre total de caches</th><th>Taux de découverte</th></tr>';
    let fdParts = firstDateStr.split('/');
    let firstDate = new Date(Date.UTC(fdParts[2], parseInt(fdParts[1])-1, fdParts[0], 12, 0, 0));

    let tdParts = todayPTStr.split('-');
    let todayUTC = new Date(Date.UTC(tdParts[0], parseInt(tdParts[1])-1, tdParts[2], 12, 0, 0));

    Object.keys(yearsData).sort().forEach(y => {
        let yNum = parseInt(y);
        let yearStart = new Date(Date.UTC(yNum, 0, 1, 12, 0, 0));
        let yearEnd = new Date(Date.UTC(yNum, 11, 31, 12, 0, 0));
        
        let startCount = (yearStart < firstDate) ? firstDate : yearStart;
        let endCount = (yearEnd > todayUTC) ? todayUTC : yearEnd;
        
        let daysInYear = Math.max(1, Math.round((endCount - startCount) / 86400000) + 1);
        let rate = (yearsData[y] / daysInYear).toFixed(4);

        html += `<tr><td>${y}</td><td>${yearsData[y]}</td><td>${rate} caches/jour</td></tr>`;
    });
    document.getElementById('annualTable').innerHTML = html;
}

function genererGrille366(daysData) {
    donneesMoisJour = {};
    let joursCouverts = 0;
    
    for(let d in daysData) {
        let md = d.substring(5, 10);
        if(!donneesMoisJour[md]) { donneesMoisJour[md] = { total: 0, annees: {} }; joursCouverts++; }
        donneesMoisJour[md].total += daysData[d].total;
        donneesMoisJour[md].annees[d.substring(0,4)] = daysData[d].total;
    }

    let pct366 = ((joursCouverts / 366) * 100).toFixed(1);
    if(document.getElementById('jours366Badge')) document.getElementById('jours366Badge').innerText = `${joursCouverts}/366 (${pct366}%)`;
    if(document.getElementById('jours366Progress')) document.getElementById('jours366Progress').style.width = `${pct366}%`;

    if(document.getElementById('grid366Text')) document.getElementById('grid366Text').innerText = `Vous avez trouvé des caches ${joursCouverts} des 366 jours de l'année.`;

    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let html = '<table class="grid-366"><tr><th></th>';
    for(let i=1; i<=31; i++) html += `<th>${i}</th>`;
    html += '<th class="total-cell">Total</th></tr>';

    let colTotals = new Array(31).fill(0);

    for(let m=0; m<12; m++) {
        html += `<tr><th>${moisAbrev[m]}</th>`;
        let rowTotal = 0;
        for(let d=1; d<=31; d++) {
            if (d > daysInMonth[m]) {
                html += '<td class="invalid">✖</td>';
            } else {
                const md = String(m+1).padStart(2,'0') + "-" + String(d).padStart(2,'0');
                const count = donneesMoisJour[md] ? donneesMoisJour[md].total : 0;
                rowTotal += count;
                colTotals[d-1] += count;
                
                if(count > 0) {
                    let intensity = 0.3 + (0.7 * (count / 50)); 
                    if (intensity > 1) intensity = 1;
                    html += `<td class="found" style="background-color: rgba(2, 135, 77, ${intensity});" onclick="ouvrirModal366('${md}')" title="${d} ${moisAbrev[m]}: ${count} caches">${count}</td>`;
                } else { html += `<td></td>`; }
            }
        }
        html += `<td class="total-cell">${rowTotal}</td></tr>`;
    }
    
    html += '<tr><th class="total-cell">Total</th>';
    for(let i=0; i<31; i++) html += `<td class="total-cell">${colTotals[i]}</td>`;
    let sumTotal = colTotals.reduce((a,b)=>a+b, 0);
    html += `<td class="grand-total">${sumTotal}</td></tr></table>`;
    
    if(document.getElementById('grid366Container')) document.getElementById('grid366Container').innerHTML = html;
}

// === GRAPHIQUES DE TYPES ET TAILLES ===
function genererGraphesTypes(fs) {
    const typeLabels = Object.keys(fs.types).sort((a,b) => fs.types[b] - fs.types[a]);
    if (chartTypes) chartTypes.destroy();
    if(document.getElementById('typeChart')) {
        chartTypes = new Chart(document.getElementById('typeChart').getContext('2d'), {
            type: 'bar',
            data: { labels: typeLabels, datasets: [{ data: typeLabels.map(l => fs.types[l]), backgroundColor: typeLabels.map(label => gcColors[label] || "#888888") }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const sizeLabels = Object.keys(fs.sizes).sort((a,b) => fs.sizes[b] - fs.sizes[a]);
    if (chartSizes) chartSizes.destroy();
    if(document.getElementById('sizeChart')) {
        chartSizes = new Chart(document.getElementById('sizeChart').getContext('2d'), {
            type: 'bar',
            data: { labels: sizeLabels, datasets: [{ data: sizeLabels.map(l => fs.sizes[l]), backgroundColor: sizeLabels.map(label => sizeColors[label] || "#9e9e9e") }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

function genererMatrice(dtData) {
    const table = document.getElementById('dtTable');
    if(!table) return;
    const notes = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"];
    
    let maxVal = 0, sumD = 0, sumT = 0, totalDT = 0, casesRemplies = 0;
    
    for (let d of notes) {
        for (let t of notes) {
            const dtInfo = dtData[`${d}/${t}`];
            let count = 0;
            if (dtInfo) { count = typeof dtInfo === 'object' ? dtInfo.count : dtInfo; }
            
            if (count > maxVal) maxVal = count;
            if (count > 0) { 
                sumD += parseFloat(d) * count; 
                sumT += parseFloat(t) * count; 
                totalDT += count; 
                casesRemplies++;
            }
        }
    }

    let pctFizzy = ((casesRemplies / 81) * 100).toFixed(1);
    if(document.getElementById('fizzyBadge')) document.getElementById('fizzyBadge').innerText = `${casesRemplies}/81 (${pctFizzy}%)`;
    if(document.getElementById('fizzyProgress')) document.getElementById('fizzyProgress').style.width = `${pctFizzy}%`;

    if(document.getElementById('dtMoyD')) document.getElementById('dtMoyD').innerText = `Difficulté Moyenne: ${totalDT > 0 ? (sumD / totalDT).toFixed(2) : 0}`;
    if(document.getElementById('dtMoyT')) document.getElementById('dtMoyT').innerText = `Terrain Moyen: ${totalDT > 0 ? (sumT / totalDT).toFixed(2) : 0}`;

    let html = `<tr>
        <th colspan="2" rowspan="2"></th>
        <th colspan="9" class="axis-label">TERRAIN</th>
        <th rowspan="2" class="dt-total">Total</th>
    </tr><tr>`;
    
    notes.forEach(t => html += `<th style="background:white; border: 1px solid #e2e8f0; border-radius:6px;">${t}</th>`);
    html += '</tr>';

    let colTotals = { "1":0, "1.5":0, "2":0, "2.5":0, "3":0, "3.5":0, "4":0, "4.5":0, "5":0 };
    window.matriceDetails = dtData;

    notes.forEach((d, idx) => {
        html += `<tr>`;
        if (idx === 0) { html += `<th rowspan="9" class="axis-label" style="writing-mode: vertical-rl; transform: rotate(180deg);">DIFFICULTÉ</th>`; }
        html += `<th style="background:white; border: 1px solid #e2e8f0; border-radius:6px;">${d}</th>`;
        
        let rowTotal = 0;
        notes.forEach(t => {
            const dtInfo = dtData[`${d}/${t}`];
            let count = 0, typesStr = "";
            if (dtInfo) { 
                if (typeof dtInfo === 'object') {
                    count = dtInfo.count;
                    typesStr = dtInfo.types ? Object.entries(dtInfo.types).map(e => `${e[0]}: ${e[1]}`).join(' | ') : "";
                } else { count = dtInfo; }
            }
            
            rowTotal += count;
            colTotals[t] += count;

            if (count > 0) {
                let intensity = 0.15 + (0.85 * (count / maxVal));
                let textColor = intensity > 0.5 ? "white" : "#1e293b";
                let titleText = `D${d}/T${t}: ${count} caches (${typesStr})`;
                html += `<td class="dt-cell" style="background-color: rgba(16, 185, 129, ${intensity}); color: ${textColor};" title="${titleText}" onclick="ouvrirModalDT('${d}', '${t}')">${count}</td>`;
            } else { 
                html += `<td class="dt-empty" style="border: 1px solid #e2e8f0;"></td>`; 
            }
        });
        html += `<td class="dt-total">${rowTotal}</td></tr>`;
    });

    html += `<tr><th colspan="2" class="dt-total" style="text-align:right;">Total</th>`;
    notes.forEach(t => html += `<td class="dt-total">${colTotals[t]}</td>`);
    html += `<td class="dt-grand-total">${totalDT}</td></tr>`;
    table.innerHTML = html;
}

// === TOP 50 DYNAMIQUE ===
function genererTop50(daysData) {
    const grid = document.getElementById('daysGrid');
    if(!grid) return;
    const joursTab = Object.keys(daysData).map(date => ({ date: date, data: daysData[date] }));
    
    joursTab.sort((a, b) => {
        if (b.data.total !== a.data.total) return b.data.total - a.data.total;
        return new Date(b.date) - new Date(a.date);
    });

    let gridHtml = "";
    joursTab.slice(0, 50).forEach((jour, idx) => { 
        let rankClass = idx === 0 ? 'rank-1' : (idx === 1 ? 'rank-2' : (idx === 2 ? 'rank-3' : ''));
        
        let textPhysiques = jour.data.physiques > 0 ? `<span style="font-size: 10px; color: #888; display:block;">Physiques: ${jour.data.physiques}</span>` : "";
        let badgeLabs = jour.data.labs > 0 ? `<div class="lab-badge">+${jour.data.labs} Labs</div>` : "";

        gridHtml += `
        <div class="day-card" onclick="ouvrirModal('${jour.date}')">
            <div class="day-rank ${rankClass}">#${idx + 1}</div>
            <span class="date">${jour.date.split('-').reverse().join('/')}</span>
            <span class="count">${jour.data.total}</span>
            ${textPhysiques}
            ${badgeLabs}
        </div>`;
    });
    grid.innerHTML = gridHtml;
}

function genererAgenda(daysData) {
    const calendarEl = document.getElementById('calendar');
    if(!calendarEl) return;
    calendarEl.innerHTML = '';
    const events = Object.keys(daysData).map(date => ({ start: date, allDay: true, extendedProps: { physiques: daysData[date].physiques, labs: daysData[date].labs, dateBrute: date } }));

    fullCalendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth', locale: 'fr', firstDay: 1,
        height: 650, // hauteur fixe : évite le bug "100%" quand panel-calendar est display:none
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridYear' },
        events: events,
        eventContent: function(arg) {
            let p = arg.event.extendedProps.physiques, l = arg.event.extendedProps.labs;
            let html = '<div style="background-color: #E8F5E9; border-left: 3px solid #02874d; padding: 2px 4px; border-radius: 3px; color: #1B5E20; font-size: 11px; font-weight:bold; white-space: normal; cursor:pointer;">';
            if (p > 0) html += `📦 ${p} `;
            if (l > 0) html += `<span style="color:#E65100">🧪 ${l}</span>`;
            html += '</div>';
            return { html: html };
        },
        eventClick: function(info) { ouvrirModal(info.event.extendedProps.dateBrute); }
    });

    fullCalendarInstance.render();
    const datesTriees = Object.keys(daysData).sort();
    if (datesTriees.length > 0) fullCalendarInstance.gotoDate(datesTriees[datesTriees.length - 1]);

    // Recalibre quand le panneau Calendrier devient visible (ResizeObserver sur le panel, pas seulement #calendar)
    const panelCal = document.getElementById('panel-calendar');
    // ✅ CORRECTIF DÉFINITIF : peu importe COMMENT l'onglet Agenda devient visible
    // (clic, restauration au chargement, vider+recharger, etc.), FullCalendar se
    // recalibre automatiquement dès que son conteneur change réellement de taille.
    if (window.ResizeObserver && !calendarEl._roAttached) {
        const ro = new ResizeObserver(() => {
            if (fullCalendarInstance) fullCalendarInstance.updateSize();
        });
        ro.observe(calendarEl.parentElement || calendarEl);
        calendarEl._roAttached = true;
    }
    if (isMainPanelVisible('calendar')) {
        requestAnimationFrame(() => { if (fullCalendarInstance) fullCalendarInstance.updateSize(); });
    }
}

// === GESTION DES FENÊTRES MODAL (POP-UP) ===
function ouvrirModal(dateStr) {
    const data = donneesGlobalesJours[dateStr];
    if (!data) return;
    let parts = dateStr.split('-');
    let dObj = new Date(Date.UTC(parts[0], parts[1]-1, parts[2]));
    document.getElementById('modalDate').innerText = dObj.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    document.getElementById('modalTotal').innerText = `Total : ${data.total} cache${data.total > 1 ? 's' : ''}`;
    
    document.getElementById('modalTypesList').innerHTML = Object.entries(data.typesDetail).sort((a, b) => b[1] - a[1]).map(item => 
        `<li><div><span style="display:inline-block; width:14px; height:14px; border-radius:50%; margin-right:10px; vertical-align:middle; background-color: ${gcColors[item[0]] || gcColors["Autre"]}"></span>${item[0]}</div><strong>${item[1]}</strong></li>`
    ).join('');
    document.getElementById('dayModal').style.display = 'block';
}

function ouvrirModal366(md) {
    const data = donneesMoisJour[md];
    if (!data) return;
    const [mois, jour] = md.split('-');
    document.getElementById('modalDate').innerText = `Tous les ${jour} ${moisNomsFull[parseInt(mois)-1]}`;
    document.getElementById('modalTotal').innerText = `Total historique : ${data.total} cache${data.total > 1 ? 's' : ''}`;
    
    document.getElementById('modalTypesList').innerHTML = Object.entries(data.annees).sort((a, b) => b[0] - a[0]).map(item => 
        `<li><div>Année ${item[0]}</div><strong>${item[1]} caches</strong></li>`
    ).join('');
    document.getElementById('dayModal').style.display = 'block';
}

function fermerModal() { document.getElementById('dayModal').style.display = 'none'; }
window.onclick = function(e) { if (e.target == document.getElementById('dayModal')) fermerModal(); }

// === PALIERS ET JALONS (CLONE PROJECT-GC) ===
function genererPaliers(allFinds) {
    if (!allFinds || allFinds.length === 0) return;

    // 1. TRI CHRONOLOGIQUE ABSOLU (Date, puis ID du log si c'est le même jour)
    allFinds.sort((a, b) => {
        let d1 = new Date(a.date).getTime();
        let d2 = new Date(b.date).getTime();
        if (d1 !== d2) return d1 - d2;
        return a.logId - b.logId;
    });

    const jalonsCibles = [1, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
    
    let htmlJalons = '';
    let htmlPays = '';
    let htmlRegion = '';
    let htmlType = '';

    let paysVus = new Set();
    let regionsVues = new Set();
    let typesVus = new Set();

    allFinds.forEach((cache, index) => {
        let currentJalon = index + 1;
        let dStr = cache.date.split('-').reverse().join('/');
        let gcLink = `<a href="https://coord.info/${cache.gcCode}" target="_blank" style="color:#3b82f6; font-weight:bold; text-decoration:none;">${cache.gcCode}</a>`;
        
        let rowHtml = `<tr>
            <td><strong>${currentJalon}</strong></td>
            <td>${dStr}</td>
            <td>${cache.country}</td>
            <td>${gcLink}</td>
            <td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${gcColors[cache.type] || '#888'}; margin-right:5px;"></span>${cache.type}</td>
            <td style="text-align:left;"><strong>${escHtml(cache.name)}</strong></td>
        </tr>`;

        // A. Vérification des Jalons Chiffrés
        if (jalonsCibles.includes(currentJalon) || currentJalon === allFinds.length) {
            htmlJalons += rowHtml;
        }

        // B. Première par Pays
        if (!paysVus.has(cache.country)) {
            paysVus.add(cache.country);
            htmlPays += rowHtml;
        }

        // C. Première par Région (France, Belgique, Allemagne, etc.)
        const PAYS_AVEC_REGIONS = ["France", "Belgium", "Belgique", "Germany", "Allemagne", "United States", "États-Unis", "Canada", "Spain", "Espagne", "United Kingdom", "Royaume-Uni", "Netherlands", "Pays-Bas", "Switzerland", "Suisse", "Italy", "Italie", "Austria", "Autriche", "Poland", "Pologne", "Czechia", "Tchéquie", "Sweden", "Suède", "Norway", "Norvège", "Finland", "Finlande", "Denmark", "Danemark", "Australia", "Australie", "Brazil", "Brésil", "Japan", "Japon"];
        const regionKey = `${cache.country}||${cache.state}`;
        if (PAYS_AVEC_REGIONS.includes(cache.country) && cache.state && cache.state !== 'Inconnue' && !regionsVues.has(regionKey)) {
            regionsVues.add(regionKey);
            htmlRegion += `<tr>
                <td><strong>${currentJalon}</strong></td>
                <td>${dStr}</td>
                <td>${cache.country}</td>
                <td>${cache.state}</td>
                <td>${gcLink}</td>
                <td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background-color:${gcColors[cache.type] || '#888'}; margin-right:5px;"></span>${cache.type}</td>
                <td style="text-align:left;"><strong>${escHtml(cache.name)}</strong></td>
            </tr>`;
        }

        // D. Première par Type
        if (!typesVus.has(cache.type)) {
            typesVus.add(cache.type);
            htmlType += rowHtml;
        }
    });

    if(document.getElementById('tbodyJalons')) document.getElementById('tbodyJalons').innerHTML = htmlJalons;
    if(document.getElementById('tbodyPays')) document.getElementById('tbodyPays').innerHTML = htmlPays;
    if(document.getElementById('tbodyRegion')) document.getElementById('tbodyRegion').innerHTML = htmlRegion;
    if(document.getElementById('tbodyType')) document.getElementById('tbodyType').innerHTML = htmlType;
}

// === NOUVEAUTÉ : RADARS HABITUDES ===
function genererRadarHabitudes(daysData) {
    let statsJours = [0,0,0,0,0,0,0]; 
    let statsMois = new Array(12).fill(0); 
    
    for(let d in daysData) {
       let parts = d.split('-');
       let dateObj = new Date(Date.UTC(parts[0], parts[1]-1, parts[2]));
       statsJours[dateObj.getUTCDay()] += daysData[d].total;
       statsMois[dateObj.getUTCMonth()] += daysData[d].total;
    }

    let radarJoursData = [statsJours[1], statsJours[2], statsJours[3], statsJours[4], statsJours[5], statsJours[6], statsJours[0]];
    let joursLabels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    if (chartRadarDays) chartRadarDays.destroy();
    if(document.getElementById('radarDaysChart')) {
        chartRadarDays = new Chart(document.getElementById('radarDaysChart').getContext('2d'), {
            type: 'radar',
            data: { labels: joursLabels, datasets: [{ label: 'Caches trouvées', data: radarJoursData, backgroundColor: 'rgba(2, 135, 77, 0.2)', borderColor: '#02874d', pointBackgroundColor: '#02874d', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true } } }
        });
    }

    if (chartRadarMonths) chartRadarMonths.destroy();
    if(document.getElementById('radarMonthsChart')) {
        chartRadarMonths = new Chart(document.getElementById('radarMonthsChart').getContext('2d'), {
            type: 'polarArea',
            data: { labels: moisNomsFull, datasets: [{ data: statsMois, backgroundColor: ['#ef444488', '#f9731688', '#f59e0b88', '#84cc1688', '#10b98188', '#14b8a688', '#06b6d488', '#0ea5e988', '#3b82f688', '#6366f188', '#8b5cf688', '#d946ef88'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }
}

// === CALCUL 360 SECTEURS (VERSION PREMIUM PROJECT-GC) ===
function calculerAzimut(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
}

let sectorDataGlobal = [];
let sortAsc360 = [true, true];
let map360Instance = null;
let mapCacheLayer = null;
let mapGridLayer = null;
let mapAutoFitDone = false; // Évite de re-zoomer en boucle quand le mode "Tout voir" redessine après un zoomend

// === CALCUL 360 SECTEURS (JUSQU'À 15 CACHES AVEC COULEURS DYNAMIQUES) ===
function generer360(geoData) {
    let coordsInput = document.getElementById('homeCoords');
    if(!coordsInput) return;
    
    let target360 = parseInt(document.getElementById('target360Slider').value) || 1;
    let coordsObj = parseGeocachingCoords(coordsInput.value);
    const homeLat = coordsObj.lat;
    const homeLon = coordsObj.lon;

    let sectors = new Array(360).fill(0);
    let cachesPerSector = Array.from({length: 360}, () => []);

    // 1. Limitation stricte à 15 caches par secteur (au lieu de 5)
    geoData.forEach(c => {
        let brng = calculerAzimut(homeLat, homeLon, c.lat, c.lon);
        let sector = Math.floor(brng);
        if(sector === 360) sector = 0;
        
        let spaceLeft = 15 - sectors[sector]; // <-- LE MAX EST PASSÉ À 15
        if (spaceLeft > 0) {
            let toAdd = Math.min(spaceLeft, c.count);
            sectors[sector] += toAdd;
            if(c.gcCode && !cachesPerSector[sector].includes(c.gcCode)) {
                cachesPerSector[sector].push(c.gcCode);
            }
        }
    });

    let completed = 0, missing = 0, max = 0, missingList = [];
    sectorDataGlobal = [];
    
    sectors.forEach((count, idx) => {
        if (count < target360) { missing++; missingList.push(idx); } else { completed++; }
        if (count > max) max = count;
        sectorDataGlobal.push({ sector: idx, count: count, caches: cachesPerSector[idx] });
    });

    if(document.getElementById('s360Completed')) document.getElementById('s360Completed').innerText = completed;
    if(document.getElementById('s360Missing')) document.getElementById('s360Missing').innerText = missing;
    if(document.getElementById('s360Max')) document.getElementById('s360Max').innerText = max;
    if(document.getElementById('badge360')) document.getElementById('badge360').innerText = `${completed}/360 Secteurs`;
    if(document.getElementById('badge360Resume')) document.getElementById('badge360Resume').innerText = `${completed}/360`;

    let htmlMissing = '';
    if (missing === 0) { htmlMissing = '<span style="color:#02874d; font-weight:bold;">🏆 Objectif atteint !</span>'; } 
    else { missingList.forEach(m => { htmlMissing += `<span class="sector-tag">${m}°</span>`; }); }
    if(document.getElementById('missingSectorsList')) document.getElementById('missingSectorsList').innerHTML = htmlMissing;

    renderTable360();

    // 2. COULEURS DYNAMIQUES SELON LE CURSEUR
    let dataPoints = sectors.map(s => s === 0 ? 0.3 : Math.min(s, 15));
    let bgColors = sectors.map(s => {
        if (s >= target360) return 'rgba(16, 185, 129, 0.8)'; // Vert : Objectif atteint !
        if (s === 0) return 'rgba(239, 68, 68, 0.8)';         // Rouge : 0 cache
        return 'rgba(245, 158, 11, 0.9)';                     // Orange : En cours (entre 1 et l'objectif)
    });

    let labels = Array.from({length: 360}, (_, i) => `${i}`);

    let canvas360 = document.getElementById('chart360');
    if(canvas360) {
        let existingChart = Chart.getChart(canvas360);
        if (existingChart) existingChart.destroy();
        new Chart(canvas360.getContext('2d'), {
            type: 'polarArea',
            data: { labels: labels, datasets: [{ data: dataPoints, backgroundColor: bgColors, borderWidth: 1, borderColor: '#ffffff22' }] },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { 
                    legend: { display: false }, 
                    tooltip: { callbacks: { label: function(ctx) { return `Secteur ${ctx.label}° : ${sectors[ctx.dataIndex]} cache(s)`; } } } 
                },
                scales: {
                    r: {
                        min: 0, max: 15, // <-- LE GRAPHIQUE VA JUSQU'À 15
                        ticks: { stepSize: 1, display: false },
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        angleLines: { color: 'rgba(0,0,0,0.1)', stepSize: 10 },
                        pointLabels: { display: false }
                    }
                }
            }
        });
    }

    if (map360Instance) updateMapPremium();
}

function renderTable360() {
    if(!document.getElementById('tbody360')) return;
    let html = '';
    sectorDataGlobal.forEach(s => {
        let gcLinks = s.caches.map(gc => `<a href="https://coord.info/${gc}" target="_blank" style="color:var(--primary); font-weight:bold; text-decoration:none;">${gc}</a>`).join(', ');
        html += `<tr><td>${s.sector}-${s.sector+1}</td><td><strong>${s.count}</strong></td><td style="text-align:left; font-size:12px;">${gcLinks}</td></tr>`;
    });
    document.getElementById('tbody360').innerHTML = html;
}

function sortTable360(colIndex) {
    let asc = sortAsc360[colIndex];
    sortAsc360[colIndex] = !asc;
    sectorDataGlobal.sort((a, b) => {
        let valA = colIndex === 0 ? a.sector : a.count;
        let valB = colIndex === 0 ? b.sector : b.count;
        return asc ? valA - valB : valB - valA;
    });
    renderTable360();
}

// === CARTE 360 PREMIUM ===
function getDestinationPoint(lat, lon, brng, distKm) {
    const R = 6371;
    const brngRad = brng * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(latRad)*Math.cos(distKm/R) + Math.cos(latRad)*Math.sin(distKm/R)*Math.cos(brngRad));
    const lon2 = lonRad + Math.atan2(Math.sin(brngRad)*Math.sin(distKm/R)*Math.cos(latRad), Math.cos(distKm/R) - Math.sin(latRad)*Math.sin(lat2));
    return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
}

function initMap360() {
    let coordsObj = parseGeocachingCoords(document.getElementById('homeCoords').value);
    const homeLat = coordsObj.lat;
    const homeLon = coordsObj.lon;
    
    if (!map360Instance) {
        map360Instance = L.map('tab360-carte', { minZoom: 10 }).setView([homeLat, homeLon], 11);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri', minZoom: 10 }).addTo(map360Instance);
        map360Instance.on('zoomend', updateMapPremium);
    } else {
        map360Instance.setView([homeLat, homeLon], map360Instance.getZoom());
    }
    updateMapPremium();
}

// === CORRECTION DU SLIDER 360 (Garde le mode sombre actif) ===
function update360Target() {
    let val = document.getElementById('target360Slider').value;
    document.getElementById('target360Val').innerText = val;
    if (window.lastGeoData) {
        generer360(window.lastGeoData); 
    }
    // MAGIE : On réapplique immédiatement le mode sombre au nouveau graphique généré !
    if (document.body.classList.contains('dark-mode')) {
        applyTheme(true);
    }
}

function updateMapPremium() {
    // Sécurité si la carte n'est pas initialisée
    if (!map360Instance) return;
    
    // Récupérer les coordonnées depuis l'input
    let coordsInput = document.getElementById('homeCoords');
    if (!coordsInput) return;
    let coordsObj = parseGeocachingCoords(coordsInput.value);
    const homeLat = coordsObj.lat;
    const homeLon = coordsObj.lon;
    
    let selectedSector = parseInt(document.getElementById('mapSectorSelector').value) || 0;
    let showAll = document.getElementById('showAllSectors').checked;
    let currentZoom = map360Instance.getZoom();

    // Vérification du zoom minimum — ne s'applique qu'au mode "1 secteur" (cercles de caches
    // individuelles, lourd à bas zoom). Le mode "Tout voir" est justement pensé pour une vue
    // dézoomée d'ensemble façon "soleil sur toute la zone explorée", donc pas de contrainte ici.
    if (!showAll && currentZoom < 10) {
        document.getElementById('zoomWarning').style.display = 'block';
        if (mapCacheLayer) map360Instance.removeLayer(mapCacheLayer);
        if (mapGridLayer) map360Instance.removeLayer(mapGridLayer);
        return;
    } else {
        document.getElementById('zoomWarning').style.display = 'none';
    }

    // Nettoyage des anciennes couches
    if (mapCacheLayer) map360Instance.removeLayer(mapCacheLayer);
    if (mapGridLayer) map360Instance.removeLayer(mapGridLayer);
    
    mapCacheLayer = L.layerGroup().addTo(map360Instance);
    mapGridLayer = L.layerGroup().addTo(map360Instance);

    // Affichage des secteurs
    if (showAll) {
        // Mode "Tout voir" : un rayon par degré (360 rayons), vert si le secteur contient au
        // moins une cache trouvée, rouge sinon — façon "soleil" complet sur toute la zone explorée,
        // chaque rayon s'étendant jusqu'à la distance réelle de la cache la plus lointaine du secteur.

        // 1. Calcule la distance réelle (km) de la cache la plus lointaine, pour chacun des 360 secteurs.
        let maxDistParSecteur = new Array(360).fill(0);
        let distanceGlobaleMax = 0;
        if (window.lastGeoData) {
            window.lastGeoData.forEach(c => {
                if (c.lat === undefined || c.lon === undefined || isNaN(c.lat) || isNaN(c.lon)) return;
                let brng = calculerAzimut(homeLat, homeLon, c.lat, c.lon);
                let sect = Math.floor(brng);
                if (sect === 360) sect = 0;
                let dist = getDistanceKM(homeLat, homeLon, c.lat, c.lon);
                if (dist > maxDistParSecteur[sect]) maxDistParSecteur[sect] = dist;
                if (dist > distanceGlobaleMax) distanceGlobaleMax = dist;
            });
        }
        // Distance plancher pour que les secteurs "vides" restent visibles à l'écran (10% du max global, mini 2km)
        let distancePlancher = Math.max(distanceGlobaleMax * 0.12, 2);

        // Lignes/étiquettes de degrés (grille de fond), à la même échelle dynamique que les rayons
        for (let i = 0; i < 360; i += 10) {
            let p = getDestinationPoint(homeLat, homeLon, i, distanceGlobaleMax > 0 ? distanceGlobaleMax * 1.05 : 80);
            L.polyline([[homeLat, homeLon], p], {color: 'rgba(255,255,255,0.25)', weight: 1, dashArray: '4,4'}).addTo(mapGridLayer);
            let icon = L.divIcon({className: 'degree-label', html: `<div style="color:white; font-weight:bold; font-size:10px; text-shadow: 1px 1px 3px black;">${i}°</div>`, iconSize: [30, 15]});
            L.marker(p, {icon: icon}).addTo(mapGridLayer);
        }

        sectorDataGlobal.forEach((s, i) => {
            let aTrouve = s.count > 0;
            let distRayon = aTrouve ? Math.max(maxDistParSecteur[i], distancePlancher * 0.6) : distancePlancher;
            let p = getDestinationPoint(homeLat, homeLon, i + 0.5, distRayon);
            L.polyline([[homeLat, homeLon], p], {
                color: aTrouve ? '#10b981' : '#ef4444',
                weight: aTrouve ? 2 : 1,
                opacity: aTrouve ? 0.85 : 0.55,
            }).addTo(mapGridLayer);
        });

        // Petits points verts pour chaque cache réellement trouvée, façon nuage de points sur la carte
        if (window.lastGeoData) {
            window.lastGeoData.forEach(c => {
                if (c.lat === undefined || c.lon === undefined || isNaN(c.lat) || isNaN(c.lon)) return;
                L.circleMarker([c.lat, c.lon], { radius: 2, fillColor: '#10b981', color: '#10b981', weight: 0, fillOpacity: 0.6 }).addTo(mapCacheLayer);
            });
        }

        // Recentre/zoome automatiquement la carte pour englober toute la zone explorée
        // (seulement à l'activation du mode, pas à chaque redraw déclenché par zoomend, sinon boucle infinie)
        if (distanceGlobaleMax > 0 && !mapAutoFitDone) {
            mapAutoFitDone = true;
            let bounds = L.latLngBounds([[homeLat, homeLon]]);
            for (let deg = 0; deg < 360; deg += 5) {
                bounds.extend(getDestinationPoint(homeLat, homeLon, deg, distanceGlobaleMax));
            }
            map360Instance.fitBounds(bounds, { padding: [20, 20] });
        }
    } else {
        // Lignes/étiquettes de degrés (grille de fond) à rayon fixe pour le mode 1 secteur (zoom proche)
        for (let i = 0; i < 360; i += 10) {
            let p = getDestinationPoint(homeLat, homeLon, i, 80);
            L.polyline([[homeLat, homeLon], p], {color: 'rgba(255,255,255,0.3)', weight: 1, dashArray: '5,5'}).addTo(mapGridLayer);
            let icon = L.divIcon({className: 'degree-label', html: `<div style="color:white; font-weight:bold; font-size:11px; text-shadow: 1px 1px 3px black;">${i}°</div>`, iconSize: [30, 15]});
            L.marker(p, {icon: icon}).addTo(mapGridLayer);
        }
        // Mode 1 secteur : met en évidence le secteur sélectionné et affiche les caches
        let p1 = getDestinationPoint(homeLat, homeLon, selectedSector, 80);
        let p2 = getDestinationPoint(homeLat, homeLon, selectedSector + 1, 80);
        L.polygon([[homeLat, homeLon], p1, p2], {color: '#3b82f6', weight: 1, fillOpacity: 0.3}).addTo(mapGridLayer);

        // Afficher les caches (utilise window.lastGeoData qui est mis à jour dans compilerEtAfficher)
        if (window.lastGeoData) {
            let cachesToShow = sectorDataGlobal.find(s => s.sector === selectedSector);
            if (cachesToShow && cachesToShow.caches) {
                let drawnCount = 0;
                window.lastGeoData.forEach(c => {
                    if (cachesToShow.caches.includes(c.gcCode) && drawnCount < 15) { // On passe à 15 max affichés
                        L.circleMarker([c.lat, c.lon], {radius: 6, fillColor: '#10b981', color: '#fff', weight: 1, fillOpacity: 1}).bindPopup(`<b>${c.gcCode}</b>`).addTo(mapCacheLayer);
                        drawnCount++;
                    }
                });
            }
        }
    }
    
    L.circleMarker([homeLat, homeLon], {radius: 8, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1}).bindPopup("<b>Domicile</b>").addTo(mapGridLayer);
}

// === GESTION DES ONGLETS (TABS) ===
function switchChartTab(tab) {
    document.getElementById('containerMonthly').style.display = tab === 'monthly' ? 'block' : 'none';
    document.getElementById('containerCumul').style.display = tab === 'cumul' ? 'block' : 'none';
    const btns = document.getElementById('containerMonthly').parentElement.querySelectorAll('.tab-btn');
    btns[0].classList.toggle('active', tab === 'monthly');
    btns[1].classList.toggle('active', tab === 'cumul');
}

function switch360Tab(tab) {
    document.getElementById('tab360-resume').style.display = tab === 'resume' ? 'block' : 'none';
    document.getElementById('tab360-table').style.display = tab === 'table' ? 'block' : 'none';
    document.getElementById('tab360-carte').style.display = tab === 'carte' ? 'block' : 'none';
    
    const btns = document.getElementById('tab360-resume').parentElement.querySelectorAll('.tab-btn');
    btns[0].classList.toggle('active', tab === 'resume');
    btns[1].classList.toggle('active', tab === 'table');
    btns[2].classList.toggle('active', tab === 'carte');

    if (tab === 'carte') {
        setTimeout(() => {
            if (!map360Instance) { initMap360(); } 
            else { 
                map360Instance.invalidateSize(); 
                updateMapPremium();
            }
        }, 100);
    }
}

function switchRadarTab(tab) {
    document.getElementById('containerRadarDays').style.display = tab === 'days' ? 'block' : 'none';
    document.getElementById('containerRadarMonths').style.display = tab === 'months' ? 'block' : 'none';
    const btns = document.getElementById('containerRadarDays').parentElement.querySelectorAll('.tab-btn');
    btns[0].classList.toggle('active', tab === 'days');
    btns[1].classList.toggle('active', tab === 'months');
}

// =====================================================================
// === CENTRE D'ANALYSE FTF AVANCÉ (CALCULS ET GRILLE) =================
// =====================================================================

function getDistanceKM(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}

function formatCoordsLabel(lat, lon) {
    const fmt = (c, isLat) => `${c >= 0 ? (isLat?'N':'E') : (isLat?'S':'W')} ${Math.floor(Math.abs(c))}° ${((Math.abs(c)-Math.floor(Math.abs(c)))*60).toFixed(3).padStart(6, '0')}`;
    return `${fmt(lat, true)} ${fmt(lon, false)}`;
}

function genererFTFList(ftfList) {
    const tBodyList = document.getElementById('ftfTableBody');
    const tBodyStats = document.getElementById('ftfStatsTableBody');
    
    if(document.getElementById('kpiFtf')) document.getElementById('kpiFtf').innerText = ftfList ? ftfList.length : 0;
    
    if (!ftfList || ftfList.length === 0) {
        if(document.getElementById('ftfBadgeTotal')) document.getElementById('ftfBadgeTotal').innerText = `0 FTF`;
        if(tBodyList) tBodyList.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Aucun FTF détecté. Utilisez {*FTF*} dans vos logs.</td></tr>`;
        return;
    }

    let homeLat = 0, homeLon = 0;
    if (document.getElementById('homeCoords').value) {
        let c = parseGeocachingCoords(document.getElementById('homeCoords').value);
        homeLat = c.lat; homeLon = c.lon;
    }

    ftfList.sort((a, b) => new Date(a.date) - new Date(b.date));
    let htmlList = '', totalDist = 0, totalInterval = 0;
    let nord = ftfList[0], sud = ftfList[0], est = ftfList[0], ouest = ftfList[0], proche = ftfList[0], eloigne = ftfList[0];
    let minDist = 999999, maxDist = -1, ftfParJour = {}, ftfParMois = {}, lastDateObj = null;

    // --- VARIABLES POUR LES NOUVEAUX TABLEAUX P-GC ---
    let firstLoc = new Set(), firstType = new Set(), dSet = new Set();
    let htmlFirstLoc = '', htmlFirstType = '', htmlPath81 = '';
    let locCount = 0, typeCount = 0, dtCount = 0, lastPathDate = null;
    let typeCounts = {}, sizeCounts = {};
    let dCounts = {"1":0,"1.5":0,"2":0,"2.5":0,"3":0,"3.5":0,"4":0,"4.5":0,"5":0};
    let tCounts = {"1":0,"1.5":0,"2":0,"2.5":0,"3":0,"3.5":0,"4":0,"4.5":0,"5":0};
    let monthCounts = new Array(12).fill(0);
    let dowCounts = new Array(7).fill(0); // 0 = Lundi ... 6 = Dimanche
    let dtMatrix = {}, totalD = 0, totalT = 0, extDTCount = 0;

    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const joursNoms = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    ftfList.forEach((ftf, index) => {
        let cDate = new Date(ftf.date);
        let intervalText = "";
        let rawDays = 0;
        if (lastDateObj) {
            rawDays = Math.round((cDate - lastDateObj) / 86400000);
            intervalText = `${rawDays} j`; 
            totalInterval += rawDays;
        }
        lastDateObj = cDate;
        let dStr = ftf.date.split('-').reverse().join('/');

        // 1. STATS GLOBALES ET RECORDS
        ftfParJour[ftf.date] = (ftfParJour[ftf.date] || 0) + 1;
        ftfParMois[ftf.date.substring(0, 7)] = (ftfParMois[ftf.date.substring(0, 7)] || 0) + 1;

        if (homeLat !== 0 && !isNaN(ftf.lat)) {
            let dist = getDistanceKM(homeLat, homeLon, ftf.lat, ftf.lon);
            totalDist += dist;
            if (dist < minDist) { minDist = dist; proche = ftf; }
            if (dist > maxDist) { maxDist = dist; eloigne = ftf; }
            if (ftf.lat > nord.lat) nord = ftf; if (ftf.lat < sud.lat) sud = ftf;
            if (ftf.lon > est.lon) est = ftf; if (ftf.lon < ouest.lon) ouest = ftf;
        }

        // Ligne de la liste principale — cliquable pour voir le type de cache en détail (comme la Matrice D/T)
        let gcLink = `<a href="https://coord.info/${ftf.gcCode}" target="_blank" style="color:#3b82f6; font-weight:bold; text-decoration:none;">${ftf.gcCode}</a>`;
        let nomEsc = escHtml(ftf.name).replace(/'/g, "&#39;");
        htmlList += `<tr style="border-bottom: 1px solid var(--border); cursor:pointer;" onclick="ouvrirModalFtfDetail('${nomEsc}', '${escHtml(ftf.type)}', '${ftf.d}', '${ftf.t}', '${dStr}', '${ftf.gcCode}')" title="Cliquer pour voir le type de cache">
            <td><strong>${index + 1}</strong></td><td>${dStr}</td>
            <td style="color:var(--text-muted); font-size:11px;">${intervalText}</td>
            <td onclick="event.stopPropagation()">${gcLink}</td>
            <td><span style="background:var(--bg); border:1px solid var(--border); padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px;">${ftf.d}/${ftf.t}</span></td>
            <td style="text-align:left;"><strong>${escHtml(ftf.name)}</strong></td>
        </tr>`;

        // 2. NOUVELLES STATS PROJECT-GC
        typeCounts[ftf.type] = (typeCounts[ftf.type] || 0) + 1;
        let sizeFormat = ftf.size ? ftf.size : "Not chosen";
        sizeCounts[sizeFormat] = (sizeCounts[sizeFormat] || 0) + 1;
        dCounts[ftf.d] = (dCounts[ftf.d] || 0) + 1;
        tCounts[ftf.t] = (tCounts[ftf.t] || 0) + 1;
        totalD += ftf.d; totalT += ftf.t;
        if (ftf.d >= 3 || ftf.t >= 3) extDTCount++;

        monthCounts[cDate.getMonth()]++;
        dowCounts[(cDate.getDay() + 6) % 7]++; // Shift 0=Sunday to 6=Sunday

        // Premier par emplacement
        let locKey = `${ftf.country} / ${ftf.state}`;
        if (!firstLoc.has(locKey)) {
            firstLoc.add(locKey); locCount++;
            htmlFirstLoc += `<tr><td>${locCount}</td><td>${dStr}</td><td>${locKey}</td><td>${gcLink}</td><td><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${gcColors[ftf.type] || '#888'}; margin-right:4px;"></span>${ftf.type}</td><td style="text-align:left;">${escHtml(ftf.name)}</td></tr>`;
        }

        // Premier par type
        if (!firstType.has(ftf.type)) {
            firstType.add(ftf.type); typeCount++;
            htmlFirstType += `<tr><td>${typeCount}</td><td>${dStr}</td><td>${ftf.country}</td><td>${gcLink}</td><td><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${gcColors[ftf.type] || '#888'}; margin-right:4px;"></span>${ftf.type}</td><td style="text-align:left;">${escHtml(ftf.name)}</td></tr>`;
        }

        // Chemin 81 & Matrice
        let dtKey = `${ftf.d}/${ftf.t}`;
        dtMatrix[dtKey] = (dtMatrix[dtKey] || 0) + 1;
        if (!dSet.has(dtKey)) {
            dSet.add(dtKey); dtCount++;
            let intText = lastPathDate ? Math.round((cDate - lastPathDate) / 86400000) + " j" : "-";
            htmlPath81 += `<tr><td>${dtCount}</td><td>${dStr}</td><td style="color:var(--text-muted); font-size:11px;">${intText}</td><td>${gcLink}</td><td style="text-align:left;"><strong>${escHtml(ftf.name)}</strong></td><td>${ftf.type}</td><td><span style="background:var(--bg); border:1px solid var(--border); padding:2px 6px; border-radius:4px; font-weight:bold; font-size:11px;">${dtKey}</span></td></tr>`;
            lastPathDate = cDate;
        }
    });

    // --- INJECTION DES DONNÉES DANS L'INTERFACE ---
    
    // Pourcentages globaux
    let totalFTF = ftfList.length;
    let pctFTF = ((totalFTF / (gpxStats ? gpxStats.count : 1)) * 100).toFixed(2);
    if(document.getElementById('ftfBadgeTotal')) document.getElementById('ftfBadgeTotal').innerText = `${totalFTF} FTF (${pctFTF}%)`;

    // Records
    let maxJour = 0, dateMaxJour = ""; for (let d in ftfParJour) { if (ftfParJour[d] > maxJour) { maxJour = ftfParJour[d]; dateMaxJour = d.split('-').reverse().join('/'); } }
    let avgDist = (totalDist / totalFTF).toFixed(1);
    let avgInterval = totalFTF > 1 ? (totalInterval / (totalFTF - 1)).toFixed(1) : 0;

    const sr = (l, v, c) => `<tr><td style="padding:6px 0; border-bottom:1px solid var(--border); width:40%; color:var(--text-muted); font-weight:600;">${l} :</td><td style="padding:6px 0; border-bottom:1px solid var(--border); color:var(--text-main);">${v} ${c ? `<a href="https://coord.info/${c}" target="_blank" style="color:#3b82f6; text-decoration:none; font-weight:bold; margin-left:8px;">${c}</a>` : ""}</td></tr>`;

    let htmlStats = sr("Distance moyenne", `<b>${avgDist} km</b> (depuis domicile)`) + sr("Intervalle moyen", `<b>${avgInterval} jours</b>`) + sr("Max en un jour", `<b>${maxJour}</b> (le ${dateMaxJour})`);
    if (minDist !== 999999) {
        htmlStats += sr("Plus proche", `<b>${minDist.toFixed(2)} km</b> - ${escHtml(proche.name)}`, proche.gcCode) + sr("Plus éloigné", `<b>${maxDist.toFixed(2)} km</b> - ${escHtml(eloigne.name)}`, eloigne.gcCode);
        htmlStats += sr("Plus au nord", `<b>${formatCoordsLabel(nord.lat, nord.lon).split(' E ')[0].split(' W ')[0]}</b> - ${escHtml(nord.name)}`, nord.gcCode);
        htmlStats += sr("Plus au sud", `<b>${formatCoordsLabel(sud.lat, sud.lon).split(' E ')[0].split(' W ')[0]}</b> - ${escHtml(sud.name)}`, sud.gcCode);
        htmlStats += sr("Plus à l'est", `<b>${formatCoordsLabel(est.lat, est.lon).split('N ')[1]?.substring(8) || formatCoordsLabel(est.lat, est.lon)}</b> - ${escHtml(est.name)}`, est.gcCode);
        htmlStats += sr("Plus à l'ouest", `<b>${formatCoordsLabel(ouest.lat, ouest.lon).split('N ')[1]?.substring(8) || formatCoordsLabel(ouest.lat, ouest.lon)}</b> - ${escHtml(ouest.name)}`, ouest.gcCode);
    }
    if(tBodyStats) tBodyStats.innerHTML = htmlStats;
    if(tBodyList) tBodyList.innerHTML = htmlList;

    // Tableaux Premières fois & Chemin 81
    if(document.getElementById('ftfLocBody')) document.getElementById('ftfLocBody').innerHTML = htmlFirstLoc;
    if(document.getElementById('ftfTypeFirstBody')) document.getElementById('ftfTypeFirstBody').innerHTML = htmlFirstType;
    if(document.getElementById('ftfPath81Body')) document.getElementById('ftfPath81Body').innerHTML = htmlPath81;

    // Helper pour générer un mini-tableau avec %
    const genMiniTable = (dataObj, isFixedScale = false, fixedArr = []) => {
        let h = `<tr><th style="background:var(--bg);">Valeur</th><th style="background:var(--bg);">Nombre</th><th style="background:var(--bg);">%</th></tr>`;
        let items = isFixedScale ? fixedArr : Object.keys(dataObj).sort((a,b) => dataObj[b] - dataObj[a]);
        items.forEach(k => {
            let count = dataObj[k] || 0;
            let pct = totalFTF > 0 ? ((count / totalFTF) * 100).toFixed(2) : 0;
            if(!isFixedScale && count === 0) return;
            h += `<tr><td style="text-align:left;">${k}</td><td><strong>${count}</strong></td><td style="color:var(--text-muted);">${pct}%</td></tr>`;
        });
        return h;
    };

    // Types et Tailles
    if(document.getElementById('ftfTypeBody')) document.getElementById('ftfTypeBody').innerHTML = genMiniTable(typeCounts);
    if(document.getElementById('ftfSizeBody')) document.getElementById('ftfSizeBody').innerHTML = genMiniTable(sizeCounts);

    // Difficulté et Terrain
    const notesArr = ["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5"];
    let hD = genMiniTable(dCounts, true, notesArr) + `<tr><td colspan="3" style="background:var(--bg); font-weight:bold;">Moyenne : ${(totalD/totalFTF).toFixed(2)}</td></tr>`;
    let hT = genMiniTable(tCounts, true, notesArr) + `<tr><td colspan="3" style="background:var(--bg); font-weight:bold;">Moyenne : ${(totalT/totalFTF).toFixed(2)}</td></tr>`;
    if(document.getElementById('ftfDBody')) document.getElementById('ftfDBody').innerHTML = hD;
    if(document.getElementById('ftfTBody')) document.getElementById('ftfTBody').innerHTML = hT;

    // Matrice D/T FTF
    if(document.getElementById('ftfDtCountBadge')) document.getElementById('ftfDtCountBadge').innerText = dtCount;
    if(document.getElementById('ftfDtExtra')) document.getElementById('ftfDtExtra').innerHTML = `<b>${extDTCount} FTFs</b> (${((extDTCount/totalFTF)*100).toFixed(1)}%) ont une cotation Difficulté ou Terrain de 3 ou plus.`;
    
    let htmlDt = `<tr><th colspan="2" rowspan="2"></th><th colspan="9" class="axis-label" style="background:transparent; border:none;">TERRAIN</th><th rowspan="2" class="dt-total">Total</th></tr><tr>`;
    notesArr.forEach(t => htmlDt += `<th style="background:var(--bg); border: 1px solid var(--border); border-radius:4px;">${t}</th>`);
    htmlDt += '</tr>';
    let colTot = {"1":0,"1.5":0,"2":0,"2.5":0,"3":0,"3.5":0,"4":0,"4.5":0,"5":0};
    notesArr.forEach((d, idx) => {
        htmlDt += `<tr>`;
        if (idx === 0) { htmlDt += `<th rowspan="9" class="axis-label" style="background:transparent; border:none; writing-mode: vertical-rl; transform: rotate(180deg);">DIFFICULTÉ</th>`; }
        htmlDt += `<th style="background:var(--bg); border: 1px solid var(--border); border-radius:4px;">${d}</th>`;
        let rTot = 0;
        notesArr.forEach(t => {
            let c = dtMatrix[`${d}/${t}`] || 0;
            rTot += c; colTot[t] += c;
            if(c > 0) { htmlDt += `<td class="dt-cell" style="background-color: rgba(16, 185, 129, 0.9); color: white;" title="${c} FTF">${c}</td>`; } 
            else { htmlDt += `<td class="dt-empty" style="border: 1px solid var(--border);"></td>`; }
        });
        htmlDt += `<td class="dt-total">${rTot}</td></tr>`;
    });
    htmlDt += `<tr><th colspan="2" class="dt-total" style="text-align:right;">Total</th>`;
    notesArr.forEach(t => htmlDt += `<td class="dt-total">${colTot[t]}</td>`);
    htmlDt += `<td class="dt-grand-total">${totalFTF}</td></tr>`;
    if(document.getElementById('ftfDtMatrix')) document.getElementById('ftfDtMatrix').innerHTML = htmlDt;

    // Mois et Jours de semaine
    let hMonth = `<tr><th style="background:var(--bg);">Mois</th><th style="background:var(--bg);">Nombre</th><th style="background:var(--bg);">%</th></tr>`;
    moisNoms.forEach((m, i) => { let pct = totalFTF > 0 ? ((monthCounts[i]/totalFTF)*100).toFixed(2) : 0; hMonth += `<tr><td style="text-align:left;">${m}</td><td><strong>${monthCounts[i]}</strong></td><td style="color:var(--text-muted);">${pct}%</td></tr>`; });
    if(document.getElementById('ftfMonthBody')) document.getElementById('ftfMonthBody').innerHTML = hMonth;

    let hDow = `<tr><th style="background:var(--bg);">Jour</th><th style="background:var(--bg);">Nombre</th><th style="background:var(--bg);">%</th></tr>`;
    let weekCount = 0, weekendCount = 0;
    joursNoms.forEach((j, i) => { 
        let c = dowCounts[i]; 
        if(i < 5) weekCount += c; else weekendCount += c;
        let pct = totalFTF > 0 ? ((c/totalFTF)*100).toFixed(2) : 0; 
        hDow += `<tr><td style="text-align:left;">${j}</td><td><strong>${c}</strong></td><td style="color:var(--text-muted);">${pct}%</td></tr>`; 
    });
    if(document.getElementById('ftfDowBody')) document.getElementById('ftfDowBody').innerHTML = hDow;
    if(document.getElementById('ftfDowExtra')) document.getElementById('ftfDowExtra').innerHTML = `<b>${weekCount}</b> trouvailles en semaine (${((weekCount/totalFTF)*100).toFixed(1)}%) | <b>${weekendCount}</b> en week-end (${((weekendCount/totalFTF)*100).toFixed(1)}%)`;

    // Appel de la grille 366 pour FTF
    genererGrille366FTF(ftfList);
}

function genererGrille366FTF(ftfList) {
    const container = document.getElementById('ftfGrid366Container');
    if (!container || !ftfList || ftfList.length === 0) return;

    let donneesFTF = {}, joursCouverts = 0, colTotals = new Array(31).fill(0);
    ftfList.forEach(ftf => {
        let md = ftf.date.substring(5, 10);
        if(!donneesFTF[md]) { donneesFTF[md] = 0; joursCouverts++; }
        donneesFTF[md]++;
    });

    document.getElementById('ftfGrid366Text').innerText = `${joursCouverts} dates de trouvaille sur 366 (${((joursCouverts/366)*100).toFixed(1)}%)`;

    let html = '<table class="grid-366" style="margin: auto;"><tr><th></th>';
    for(let i=1; i<=31; i++) html += `<th>${i}</th>`;
    html += '<th class="total-cell">Total</th></tr>';

    for(let m=0; m<12; m++) {
        html += `<tr><th>${moisAbrev[m]}</th>`;
        let rowTotal = 0;
        for(let d=1; d<=31; d++) {
            if (d > [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]) { html += '<td class="invalid">✖</td>'; } 
            else {
                const md = String(m+1).padStart(2,'0') + "-" + String(d).padStart(2,'0');
                const count = donneesFTF[md] || 0;
                rowTotal += count; colTotals[d-1] += count;
                html += count > 0 ? `<td class="found" style="background-color: rgba(2, 135, 77, ${Math.min(0.3 + (count/5), 1)});" title="${count} FTF">${count}</td>` : `<td></td>`;
            }
        }
        html += `<td class="total-cell">${rowTotal}</td></tr>`;
    }
    
    html += '<tr><th class="total-cell">Total</th>';
    for(let i=0; i<31; i++) html += `<td class="total-cell">${colTotals[i]}</td>`;
    html += `<td class="grand-total">${colTotals.reduce((a,b)=>a+b,0)}</td></tr></table>`;
    container.innerHTML = html;
}

// === GESTION ONGLET TYPES/TAILLES ===
function switchDetailsTab(tab) {
    document.getElementById('containerTypes').style.display = tab === 'types' ? 'block' : 'none';
    document.getElementById('containerSizes').style.display = tab === 'sizes' ? 'block' : 'none';
    const btns = document.getElementById('containerTypes').parentElement.querySelectorAll('.tab-btn');
    btns[0].classList.toggle('active', tab === 'types');
    btns[1].classList.toggle('active', tab === 'sizes');
}



// === MODAL DÉTAIL D'UN FTF (clic sur une ligne de la liste FTF officiels) ===
function ouvrirModalFtfDetail(nom, type, d, t, dateStr, gcCode) {
    document.getElementById('modalDate').innerText = `🥇 ${nom}`;
    document.getElementById('modalTotal').innerHTML = `Trouvée le ${dateStr} — Difficulté/Terrain : <strong>${d}/${t}</strong>` +
        (gcCode ? ` — <a href="https://coord.info/${gcCode}" target="_blank" style="color:#3b82f6; font-weight:bold; text-decoration:none;">${gcCode}</a>` : '');

    let color = gcColors[type] || gcColors["Autre"];
    document.getElementById('modalTypesList').innerHTML =
        `<li><div><span style="display:inline-block; width:14px; height:14px; border-radius:50%; margin-right:10px; vertical-align:middle; background-color: ${color}"></span>${type}</div></li>`;

    document.getElementById('dayModal').style.display = 'block';
}

// === MODAL MATRICE D/T (Affiche les types de caches au clic) ===
// Ouvre la modale générique avec le détail d'une région cliquée sur une carte (pays ou monde)
function ouvrirModalRegion(displayName, count, typesDetail) {
    if (!count) return;
    document.getElementById('modalDate').innerText = `🗺️ ${displayName}`;
    document.getElementById('modalTotal').innerText = `Total : ${count} cache${count > 1 ? 's' : ''}`;

    let htmlTypes = '';
    if (typesDetail && Object.keys(typesDetail).length > 0) {
        let sortedTypes = Object.entries(typesDetail).sort((a, b) => b[1] - a[1]);
        sortedTypes.forEach(item => {
            let color = gcColors[item[0]] || gcColors["Autre"];
            htmlTypes += `<li><div><span style="display:inline-block; width:14px; height:14px; border-radius:50%; margin-right:10px; vertical-align:middle; background-color: ${color}"></span>${item[0]}</div><strong>${item[1]}</strong></li>`;
        });
    } else {
        htmlTypes = `<li style="justify-content:center; color:#94a3b8;">Détail par type non disponible</li>`;
    }

    document.getElementById('modalTypesList').innerHTML = htmlTypes;
    document.getElementById('dayModal').style.display = 'block';
}

// Branche l'événement clic ("select") d'un GeoChart pour ouvrir la modale région.
// rowsInfo[i] = { display, count, types } dans le même ordre que les lignes ajoutées au DataTable.
function brancherClicCarte(chart, dataTable, rowsInfo) {
    google.visualization.events.addListener(chart, 'select', function () {
        let sel = chart.getSelection();
        if (!sel || sel.length === 0) return;
        let row = sel[0].row;
        if (row === null || row === undefined) return;
        let info = rowsInfo[row];
        if (!info) return;
        ouvrirModalRegion(info.display, info.count, info.types);
    });
}

function ouvrirModalDT(d, t) {
    if (!window.matriceDetails) return;
    const dtInfo = window.matriceDetails[`${d}/${t}`];
    if (!dtInfo || dtInfo.count === 0) return;
    
    document.getElementById('modalDate').innerText = `🎯 Combinaison D${d} / T${t}`;
    document.getElementById('modalTotal').innerText = `Total : ${dtInfo.count} cache${dtInfo.count > 1 ? 's' : ''}`;
    
    let htmlTypes = '';
    if (dtInfo.types) {
        let sortedTypes = Object.entries(dtInfo.types).sort((a, b) => b[1] - a[1]);
        sortedTypes.forEach(item => {
            let color = gcColors[item[0]] || gcColors["Autre"];
            htmlTypes += `<li><div><span style="display:inline-block; width:14px; height:14px; border-radius:50%; margin-right:10px; vertical-align:middle; background-color: ${color}"></span>${item[0]}</div><strong>${item[1]}</strong></li>`;
        });
    }
    
    document.getElementById('modalTypesList').innerHTML = htmlTypes;
    document.getElementById('dayModal').style.display = 'block';
}

// === GÉNÉRER LA LISTE DES FTF OUBLIÉS ===
function genererMissedFTFList(missedList) {
    const tBody = document.getElementById('missedFtfTableBody');
    if(document.getElementById('badgeMissedFtf')) document.getElementById('badgeMissedFtf').innerText = missedList ? missedList.length : 0;
    
    if (!missedList || missedList.length === 0) {
        if(tBody) tBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#888;">Aucun FTF oublié détecté ! Tout est bien taggé.</td></tr>`;
        return;
    }

    missedList.sort((a, b) => new Date(b.date) - new Date(a.date)); 
    let html = '';
    missedList.forEach(ftf => {
        let dStr = ftf.date.split('-').reverse().join('/');
        // S'affiche en rouge pour attirer l'attention
        html += `<tr><td><strong>${dStr}</strong></td><td style="color:#ef4444; font-weight:bold;">${ftf.gcCode}</td><td>${ftf.name}</td></tr>`;
    });
    if(tBody) tBody.innerHTML = html;
}

// =====================================================================
// === GESTION DES ONGLETS EXPLOITS & PALIERS ==========================
// =====================================================================
function switchExploitsTab(tab) {
    document.getElementById('tabContent-ftf').style.display = tab === 'ftf' ? 'block' : 'none';
    document.getElementById('tabContent-missedFtf').style.display = tab === 'missedFtf' ? 'block' : 'none';
    document.getElementById('tabContent-milestones').style.display = tab === 'milestones' ? 'block' : 'none';
    
    const btns = document.getElementById('tabContent-ftf').parentElement.querySelectorAll('.tab-btn');
    if (btns.length >= 3) {
        btns[0].classList.toggle('active', tab === 'ftf');
        btns[1].classList.toggle('active', tab === 'missedFtf');
        btns[2].classList.toggle('active', tab === 'milestones');
    }
    if (tab === 'ftf' && window.lastFtfList) setTimeout(() => dessinerCarteFTFDynamique(window.lastFtfList), 100);
}

// =====================================================================
// === MODULE FTF OUBLIÉS (MOTEUR HYBRIDE INTELLIGENT) =================
// =====================================================================
let ftfGpxContent = "";
let ftfTxtContent = "";

// Mise à jour visuelle des boutons
function updateFtfBtn(id, isLoaded, text) {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (isLoaded) {
        btn.innerText = "✅ " + text + " Chargé";
        btn.style.backgroundColor = "#d1fae5";
        btn.style.borderColor = "#059669";
    } else {
        btn.innerText = (id === 'ftfGpxBtn') ? "📁 1. GPX (Zone)" : "📄 2. TXT (Project-GC)";
        btn.style.backgroundColor = "#fefce8";
        btn.style.borderColor = "#eab308";
    }
}

// Chargement des fichiers
window.addEventListener('load', () => {
    const ftfGpxInput = document.getElementById('ftfGpxInput');
    if (ftfGpxInput) {
        ftfGpxInput.addEventListener('change', e => {
            if (!e.target.files[0]) return;
            const reader = new FileReader();
            reader.onload = ev => { ftfGpxContent = ev.target.result; updateFtfBtn('ftfGpxBtn', true, "GPX"); };
            reader.readAsText(e.target.files[0]);
        });
    }

    const ftfTxtInput = document.getElementById('ftfTxtInput');
    if (ftfTxtInput) {
        ftfTxtInput.addEventListener('change', e => {
            if (!e.target.files[0]) return;
            const reader = new FileReader();
            reader.onload = ev => { ftfTxtContent = ev.target.result; updateFtfBtn('ftfTxtBtn', true, "TXT"); };
            reader.readAsText(e.target.files[0]);
        });
    }
});

// === GESTION DE LA SUPPRESSION INDIVIDUELLE DES DONNÉES (TOUS LES BOUTONS 🗑️) ===
// ⚠️ Cette fonction gère TOUS les cas (gpx, labs, draftTxt, draftGpx, ftfGpx, ftfTxt).
// Un doublon de cette fonction existait plus loin dans le fichier et écrasait la gestion
// des fichiers FTF (ftfGpx/ftfTxt), rendant les boutons 🗑️ de cette section inopérants.
function clearSpecific(type) {
    if (type === 'gpx') {
        localStorage.removeItem('gpxStats_final_vSEATTLE');
        gpxStats = null;
        let btn = document.getElementById('gpxBtn');
        btn.innerHTML = "📁 Charger le fichier .gpx";
        btn.style.background = "#f8fafc";
        btn.style.color = "#475569";
        btn.style.borderColor = "#cbd5e1";
    } 
    else if (type === 'labs') {
        localStorage.removeItem('labStats_final_vSEATTLE');
        labStats = null;
        let btn = document.getElementById('csvBtn');
        btn.innerHTML = "📁 Charger \"mes-labs.txt\"";
        btn.style.background = "#f8fafc";
        btn.style.color = "#475569";
        btn.style.borderColor = "#cbd5e1";
    } 
    else if (type === 'draftTxt') {
        localStorage.removeItem('draftTxt_final_vSEATTLE'); 
        window.draftDates = {};
        let btn = document.getElementById('draftTxtBtn');
        btn.innerHTML = "📄 1. Charger .txt";
        btn.style.background = "#f5f3ff";
        btn.style.color = "#7c3aed";
        btn.style.borderColor = "#8b5cf6";
        if (document.getElementById('draftStatus')) document.getElementById('draftStatus').innerText = "🗑️ Dates TXT effacées.";
    } 
    else if (type === 'draftGpx') {
        localStorage.removeItem('draftStats_final_vSEATTLE');
        draftStats = null;
        let btn = document.getElementById('draftBtn');
        btn.innerHTML = "📁 2. Charger .gpx";
        btn.style.background = "#eff6ff";
        btn.style.color = "#2563eb";
        btn.style.borderColor = "#3b82f6";
    }
    else if (type === 'ftfGpx') {
        ftfGpxContent = "";
        updateFtfBtn('ftfGpxBtn', false, "");
    }
    else if (type === 'ftfTxt') {
        ftfTxtContent = "";
        updateFtfBtn('ftfTxtBtn', false, "");
    }
    
    compilerEtAfficher();
}

// 🔧 NORMALISATION DES APOSTROPHES : Geocaching.com et les claviers mobiles utilisent
// indifféremment l'apostrophe droite (') et l'apostrophe typographique (' U+2019, ou ` U+0060).
// Sans cette normalisation, des regex comme "l'avant" ne matchent QUE l'apostrophe droite,
// ce qui fait passer à travers des cas pourtant prévus par le moteur (faux négatif silencieux).
function normaliserApostrophes(texte) {
    if (!texte) return "";
    return texte.replace(/[\u2018\u2019\u02BC\u0060\u00B4]/g, "'");
}

// 🧠 CERVEAU : Analyse du texte pour éviter les "STF"
function estUnFtfOublieValide(texteBrut) {
    let texte = normaliserApostrophes(texteBrut).toLowerCase();
    
    // S'il y a déjà les crochets officiels, ce n'est pas un oubli !
    if (texte.includes("[ftf]") || texte.includes("{ftf}") || texte.includes("*ftf*") || texte.includes("(ftf)")) return false;
    
    // Si on détecte un aveu d'échec (STF, loupé, etc.), on rejette !
    let regexNegation = /\b(pas de ftf|pas ftf|no ftf|loupé le ftf|raté le ftf|ftf loupé|ftf raté|stf|ttf|deuxième|troisième|devancé)\b/g;
    if (regexNegation.test(texte)) return false; 
    
    return true; 
}

// 🧹 LISSEUR DE NOM : Enlève les accents et la ponctuation pour la fusion
// Nettoyage et normalisation d'un nom de cache (utilisé pour déduplication)
function nettoyerNomCache(nom) {
    if (!nom) return "";
    // Enlève la partie " by Auteur" si présente (GPX contient parfois "Name by Author")
    nom = nom.split(/ by /i)[0].trim();
    return nom.toLowerCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève les accents
              .replace(/[^a-z0-9]/g, ""); // Ne garde que les lettres et chiffres
}

// =====================================================================
// === MOTEUR FTF OUBLIÉS (INTELLIGENCE SÉMANTIQUE & PROBABILITÉS) =====
// =====================================================================
let exclusResults = []; 
let ftfResults = [];    

// 🧠 FILTRE 1 : Tag officiel explicite
function estOfficiellementTaggue(texte) {
    return /\{\*ftf\*\}|\{ftf\}|\[ftf\]|\(ftf\)/i.test(normaliserApostrophes(texte));
}

// 🧠 FILTRE 2 : Aveux d'échec stricts
function contientNegationSTF(texte) {
    return /\b(pas de ftf|pas ftf|no ftf|aucun ftf|loupé le ftf|raté le ftf|ftf loupé|ftf raté|stf|ttf|les deuxièmes|les 2ème|les 2eme|suis 2ème|suis deuxième|sommes 2ème|sommes deuxième|devancé)\b/i.test(normaliserApostrophes(texte));
}

// 🧠 FILTRE 3 : Les Quiproquos Contextuels (NOUVEAU)
// Détecte les phrases où le mot FTF est utilisé, mais pour parler d'une AUTRE cache.
function contientFauxPositifFTF(texte) {
    return /(ftf sur l'avant|ftf sur la préc|pas.*?en ftf|ftf.*sur une autre|aucun.*?ftf)/i.test(normaliserApostrophes(texte));
}

// 🧠 FILTRE 4 : Preuve positive (sans les crochets)
function contientPreuveFTF(texte) {
    let t = normaliserApostrophes(texte);
    return /\b(ftf|premier|preum's|preums|patbf|first to find)\b/i.test(t) || /en premier/i.test(t);
}

// (nettoyerNomCache est déjà défini plus haut dans le fichier — doublon supprimé)

function echapperHtml(str) {
    return (str || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escHtml(s) { return echapperHtml(s); }

// 🧮 LE CALCULATEUR DE PROBABILITÉS
function calculerProbabilite(c) {
    let score = 50; 
    let text = (c.fullText || "").toLowerCase();

    // 1. Poids du fichier TXT (Le "Patron")
    if (c.txtNumLogs !== undefined) {
        if (c.txtNumLogs <= 2) score += 35;       
        else if (c.txtNumLogs <= 4) score += 10;  
        else if (c.txtNumLogs <= 7) score -= 15;  
        else score -= 40;                         
    }

    // 2. Poids du fichier GPX (La Chronologie)
    if (c.gpxFound) {
        // On utilise le flag fiable : un AUTRE joueur a-t-il réellement loggué
        // "found it" / "attended" avant lui ? Une simple "write note" (note du
        // propriétaire, du reviewer, etc.) ne compte pas comme une découverte concurrente.
        if (c.autreDecouverteAvant === true) {
            score -= 40; // Quelqu'un d'autre a vraiment trouvé/assisté avant : doute légitime
        } else if (c.isFirstGpxLog) {
            score += 30; // Premier log "valide" dans le GPX : bon signe
        }
        // Si autreDecouverteAvant est false et isFirstGpxLog est aussi false (ex: seule une
        // write note du propriétaire précède le joueur), on ne pénalise plus à tort : on
        // laisse le score du TXT (poids des logs Project-GC) parler.

        if (c.isFirstGpxLog && c.hasPublish) score += 20; 
    }

    // 3. Bonus Mots-clés (À condition qu'il n'y ait pas de quiproquo)
    if (contientPreuveFTF(text) && !contientFauxPositifFTF(text)) {
        score += 30;
    }

    // 4. Boost Mots-clés indirects
    if (/\b(bingo)\b/i.test(text)) {
        score += 15;
    }

    if (score > 100) score = 100;
    if (score < 5) score = 5;
    return score;
}

// 🚀 L'ANALYSEUR PRINCIPAL
function lancerAnalyseFtfOublies() {
    if (!ftfTxtContent) { alert("⚠️ Le fichier TXT (Project-GC) est obligatoire car c'est lui le Patron !"); return; }
    const pseudo = document.getElementById('username').value.trim().toLowerCase();
    const btn = document.getElementById('btnLancerFtfOublies');
    if(btn) btn.innerText = "⏳ Analyse stricte en cours...";
    
    setTimeout(() => {
        try {
            let fusionMap = new Map();
            exclusResults = [];
            ftfResults = [];

            // --- 1. LECTURE DU FICHIER TXT (CRÉATION DE LA BOÎTE FERMÉE) ---
            const lignes = ftfTxtContent.split('\n');
            let cacheEnCours = null;
            
            for (let ligne of lignes) {
                ligne = ligne.trim();
                // Ignorer les lignes inutiles
                if (!ligne || ligne.startsWith("Pseudo:") || ligne.includes("Cache\tDate de visite")) continue;
                
                // Découpage strict par tabulation (\t) basé sur ton fichier
                let parts = ligne.split('\t');
                
                // Si la ligne a au moins 4 colonnes et que la colonne 3 est une date (YYYY-MM-DD)
                if (parts.length >= 4 && /^\d{4}-\d{2}-\d{2}$/.test(parts[2].trim())) {
                    if (cacheEnCours) fusionMap.set(nettoyerNomCache(cacheEnCours.name), cacheEnCours);
                    
                    cacheEnCours = { 
                        source: "Project-GC", 
                        gcCode: "P-GC", 
                        name: parts[1].trim(), 
                        type: parts[0] ? parts[0].trim() : "", // Type de cache (1ère colonne du TXT Project-GC)
                        date: parts[2].trim(), 
                        txtNumLogs: parseInt(parts[3].trim(), 10) || 0, // Récupération parfaite du nombre de logs
                        fullText: "", 
                        gpxFound: false 
                    };
                } 
                // Sinon, c'est le texte du log de la cache en cours
                else if (cacheEnCours && !ligne.includes("Afficher le log")) {
                    cacheEnCours.fullText += ligne + " ";
                }
            }
            if (cacheEnCours) fusionMap.set(nettoyerNomCache(cacheEnCours.name), cacheEnCours);

            // --- 2. LECTURE DU FICHIER GPX (POUR ENRICHISSEMENT UNIQUEMENT) ---
            if (ftfGpxContent && pseudo) {
                const parser = new DOMParser();
                const xml = parser.parseFromString(ftfGpxContent, "text/xml");
                const wpts = xml.getElementsByTagName("wpt");
                
                for (let wpt of wpts) {
                    let groundspeakName = wpt.getElementsByTagNameNS("*", "cache")[0]?.getElementsByTagNameNS("*", "name")[0]?.textContent;
                    let descRaw = wpt.getElementsByTagNameNS("*", "desc")[0]?.textContent || "Inconnue";
                    let cacheNameRaw = groundspeakName || descRaw.split(" by ")[0].trim(); 
                    
                    let cacheKey = nettoyerNomCache(cacheNameRaw);
                    
                    // ⛔ LA RÈGLE D'OR : Le TXT est le Patron ! 
                    // Si la cache du GPX n'est pas dans notre Map, on la jette immédiatement.
                    let existing = fusionMap.get(cacheKey);
                    if (!existing) continue; 
                    
                    let gcCodeRaw = wpt.getElementsByTagNameNS("*", "name")[0]?.textContent || "?";
                    let logs = wpt.getElementsByTagNameNS("*", "log");
                    let validLogs = [], publishLog = null, someoneElseSaidFtf = false;
                    
                    for (let log of logs) {
                        if (log.getElementsByTagNameNS("*", "type")[0]?.textContent === "Publish Listing") publishLog = log;
                        let finder = log.getElementsByTagNameNS("*", "finder")[0]?.textContent.toLowerCase();
                        let text = log.getElementsByTagNameNS("*", "text")[0]?.textContent || "";
                        let typeLog = log.getElementsByTagNameNS("*", "type")[0]?.textContent.toLowerCase();
                        if (["found it", "attended", "write note"].includes(typeLog)) {
                            // On garde une trace du type pour pouvoir distinguer plus loin
                            // une VRAIE découverte (found it / attended) d'une simple note (write note),
                            // qui ne prouve absolument rien sur un éventuel FTF concurrent.
                            validLogs.push({ finder, id: parseInt(log.getAttribute("id")), text, typeLog, estDecouverte: (typeLog === "found it" || typeLog === "attended") });
                        }
                    }
                    validLogs.sort((a,b) => a.id - b.id); // Tri chronologique
                    let userLogs = validLogs.filter(l => l.finder === pseudo);
                    // On ne regarde que les VRAIES découvertes d'AUTRES joueurs pour juger d'un FTF concurrent.
                    // Une "write note" (note du propriétaire, du reviewer, ou même du joueur lui-même avant
                    // de logguer "found it") ne prouve rien : elle ne doit pas faire chuter le score.
                    let decouvertesAutres = validLogs.filter(l => l.estDecouverte && l.finder !== pseudo);

                    // Vérifier si quelqu'un a crié victoire AVANT le premier log du joueur
                    for(let l of validLogs) { 
                        if (userLogs.length > 0 && l.id < userLogs[0].id && /\b(ftf|preums|premier)\b/i.test(l.text)) {
                            someoneElseSaidFtf = true; 
                        }
                    }

                    // On met à jour la cache du TXT avec les super-pouvoirs du GPX
                    existing.gcCode = gcCodeRaw;
                    existing.name = cacheNameRaw; // On prend le vrai nom propre du GPX
                    existing.gpxFound = true;
                    existing.hasPublish = (publishLog !== null);
                    existing.someoneElseSaidFtf = someoneElseSaidFtf;
                    existing.isFirstGpxLog = (validLogs.length > 0 && userLogs.length > 0 && validLogs[0].id === userLogs[0].id);
                    // Nouveau flag, plus fiable : un AUTRE joueur a-t-il réellement trouvé/assisté avant lui ?
                    // (en ignorant les simples "write note" qui ne sont pas des découvertes)
                    existing.autreDecouverteAvant = (userLogs.length > 0) && decouvertesAutres.some(l => l.id < userLogs[0].id);

                    if (userLogs.length > 0) {
                        existing.fullText += " " + userLogs.map(l => l.text).join(" ");
                    }
                    existing.source = "GPX + Project-GC";

                    fusionMap.set(cacheKey, existing);
                }
            }

            // --- 3. TRAITEMENT DES EXCLUSIONS ET DES SCORES ---
            for (let [key, c] of fusionMap) {
                let fullTxt = c.fullText || "";

                // Filtre 1 : Le joueur a déjà mis les crochets officiels
                if (estOfficiellementTaggue(fullTxt)) {
                    exclusResults.push({ date: c.date, name: c.name, log: fullTxt, raison: "✅ Déjà taggué officiel" });
                    continue;
                }

                // Filtre 2 : Aveu d'échec explicite (STF, etc.) — voir contientNegationSTF() plus haut dans le fichier
                if (contientNegationSTF(fullTxt)) {
                    exclusResults.push({ date: c.date, name: c.name, log: fullTxt, raison: "🧊 Aveu d'échec (STF) détecté" });
                    continue;
                }

                // LE NOUVEAU FILTRE EST ICI :
                if (contientFauxPositifFTF(fullTxt)) {
                    exclusResults.push({ date: c.date, name: c.name, log: fullTxt, raison: "⚠️ Quiproquo contextuel" });
                    continue;
                }

                // Filtre 3 : Le GPX prouve qu'un autre joueur a logué "FTF" avant lui
                if (c.someoneElseSaidFtf) {
                    exclusResults.push({ date: c.date, name: c.name, log: fullTxt, raison: "👤 Un autre joueur a le FTF" });
                    continue;
                }

                // Si elle survit, on calcule son pourcentage et on l'affiche !
                c.proba = calculerProbabilite(c);
                ftfResults.push(c);
            }

            afficherTableauFtfOublies();
            afficherExclus();
            if(btn) btn.innerText = "Lancer l'analyse 🕵️";

        } catch (e) { 
            console.error("Erreur FTF :", e);
            alert("Erreur lors de l'analyse : " + e.message); 
            if(btn) btn.innerText = "Lancer l'analyse 🕵️";
        }
    }, 100);
}

// 🎨 GESTION DE L'AFFICHAGE DU TABLEAU
function afficherTableauFtfOublies() {
    const tBody = document.getElementById('missedFtfTableBody');
    const badge = document.getElementById('badgeMissedFtfLabel');
    if (!tBody) return;
    
    let activeFilter = document.getElementById('filterProba').value;
    let searchQuery = document.getElementById('searchFtf').value.toLowerCase();

    // Application des filtres de recherche et probabilités
    let listFiltree = ftfResults.filter(c => {
        let matchRecherche = c.name.toLowerCase().includes(searchQuery) || (c.gcCode && c.gcCode.toLowerCase().includes(searchQuery));
        let matchProba = true;
        if (activeFilter === "high") matchProba = c.proba > 70;
        if (activeFilter === "medium") matchProba = c.proba > 30 && c.proba <= 70;
        if (activeFilter === "low") matchProba = c.proba <= 30;
        return matchRecherche && matchProba;
    });

    if (badge) badge.innerText = `${listFiltree.length} Oubli(s)`;

    if (listFiltree.length === 0) {
        tBody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px; color:#64748b;">Aucun résultat ne correspond à vos filtres.</td></tr>`;
        return;
    }

    // Tri par probabilité décroissante, puis date
    listFiltree.sort((a, b) => b.proba - a.proba || new Date(b.date) - new Date(a.date));

    let html = '';
    listFiltree.forEach(ftf => {
        let dStr = (ftf.date || '').split('-').reverse().join('/');
        let colorProba = ftf.proba > 70 ? "#10b981" : (ftf.proba > 30 ? "#f59e0b" : "#ef4444");
        let iconProba = ftf.proba > 70 ? "🔥" : (ftf.proba > 30 ? "⚡" : "🧊");
        
        let gcLink = (ftf.gcCode && ftf.gcCode !== "P-GC" && ftf.gcCode !== "?")
            ? `<a href="https://coord.info/${ftf.gcCode}" target="_blank" style="color:#2563eb; text-decoration:none; font-weight:bold;">${ftf.gcCode}</a>`
            : `<span style="color:#64748b; font-weight:bold;">${ftf.gcCode || 'P-GC'}</span>`;

        html += `
        <tr>
            <td style="font-size:12px;"><strong>${dStr}</strong><br><span style="color:#94a3b8; font-size:10px;">${ftf.source || ''}</span></td>
            <td style="text-align:center;"><span style="background:${colorProba}22; color:${colorProba}; padding:4px 8px; border-radius:12px; font-weight:bold; font-size:12px;">${iconProba} ${ftf.proba}%</span></td>
            <td>${gcLink}<br><span style="font-size:13px;">${escHtml(ftf.name)}</span></td>
        </tr>`;
    });

    tBody.innerHTML = html;
}

function filtrerTableauFtf() {
    afficherTableauFtfOublies();
}

// 🧭 NAVIGATION PRINCIPALE PAR ONGLETS (façon navigateur) : un seul panneau visible à la fois,
// pour éviter d'avoir à tout scroller sur une page interminable.
const MAIN_TABS = ['overview', 'calendar', 'matrix', 'maps', 'ftf', 'challenge360', 'tools'];

function isMainPanelVisible(tabId) {
    const panel = document.getElementById('panel-' + tabId);
    return panel && panel.style.display !== 'none';
}

function activerMainTabBtn(tabId) {
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        btn.classList.toggle('active', onclick.includes("'" + tabId + "'"));
    });
}

// Recalcule les widgets tierces (FullCalendar, GeoChart, Leaflet) une fois le panneau visible.
function rafraichirWidgetsOnglet(tabId) {
    if (tabId === 'calendar' && fullCalendarInstance) {
        fullCalendarInstance.updateSize();
    }
    if (tabId === 'maps' && window.lastLocationsData) {
        let countries = Object.keys(window.lastLocationsData).filter(c => c !== 'Inconnu' && window.lastLocationsData[c].count > 0);
        countries.sort((a, b) => window.lastLocationsData[b].count - window.lastLocationsData[a].count);
        appellerQuandGooglePret(() => {
            dessinerCartesActive(window.lastLocationsData, countries.slice(0, 5));
            if (window.lastFtfList) dessinerCarteFTFDynamique(window.lastFtfList);
        });
    }
    if (tabId === 'challenge360' && map360Instance) {
        map360Instance.invalidateSize();
    }
}

function switchMainTab(tabId) {
    MAIN_TABS.forEach(id => {
        const panel = document.getElementById('panel-' + id);
        if (panel) panel.style.display = (id === tabId) ? 'block' : 'none';
    });
    activerMainTabBtn(tabId);
    const bar = document.getElementById('mainTabsBar');
    if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { localStorage.setItem('mainTab_actif', tabId); } catch (e) {}

    // Les librairies tierces se figent si elles sont dessinées alors que le panel est caché.
    // On attend que le layout soit recalculé après display:block, puis on redessine.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => rafraichirWidgetsOnglet(tabId));
    });
}

// 🆘 GESTION GÉNÉRIQUE DES BOÎTES D'AIDE (❓) — utilisée sur tout le dashboard
function toggleAide(id) {
    const box = document.getElementById(id);
    if (!box) return;
    box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'block' : 'none';
}

// 🗑️ GESTION DU TIROIR DES CACHES EXCLUES
function toggleExclus() {
    const content = document.getElementById('exclusContent');
    const chevron = document.getElementById('chevronExclus');
    if (content.style.display === "none" || content.style.display === "") {
        content.style.display = "block";
        chevron.innerText = "▲";
    } else {
        content.style.display = "none";
        chevron.innerText = "▼";
    }
}

function afficherExclus() {
    document.getElementById('exclusCount').innerText = exclusResults.length;
    let container = document.getElementById('exclusContent');
    
    if (exclusResults.length === 0) {
        container.innerHTML = `<p style="color: #94a3b8; text-align: center; margin: 5px;">Aucune exclusion pour le moment.</p>`;
        return;
    }

    exclusResults.sort((a, b) => new Date(b.date) - new Date(a.date));
    let html = '';
    exclusResults.forEach(e => {
        let textLogSafe = escHtml(e.log);
        let textLogShort = textLogSafe.substring(0, 150) + (textLogSafe.length > 150 ? '...' : '');
        
        html += `
        <div style="border-bottom: 1px solid #e2e8f0; padding: 8px 0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color: #1e293b; font-size: 13px;">${escHtml(e.name)}</strong>
                <span style="background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:4px; font-weight:bold; font-size: 11px;">${e.raison}</span>
            </div>
            <div style="color: #64748b; margin-top: 4px; font-style: italic;">"${textLogShort}"</div>
        </div>`;
    });
    container.innerHTML = html;
}

// 🗑️ GESTION DU TIROIR DES CACHES EXCLUES
// (afficherExclus est déjà défini plus haut dans le fichier — doublon supprimé)

// === RACCOURCIS CLAVIER ===
document.addEventListener('keydown', function(event) {
    // 1. On ignore tout si tu écris dans une zone de texte (Input ou Textarea)
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

    // 2. Touche P seule = Mode Prévisionnel
    if (event.key.toLowerCase() === 'p') {
        let toggleBtn = document.getElementById('togglePrevisionnel');
        if (toggleBtn) {
            toggleBtn.checked = !toggleBtn.checked;
            // On déclenche l'événement 'change' pour que le dashboard comprenne qu'il doit se mettre à jour
            toggleBtn.dispatchEvent(new Event('change'));
        }
    }
    
    // 3. Touche F = Fermer / Rouvrir tous les menus
    if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.altKey && !event.metaKey) { 
        fermerModal(); 
        if (typeof leafletMap !== 'undefined' && leafletMap) leafletMap.closePopup();
        if (typeof map360Instance !== 'undefined' && map360Instance) map360Instance.closePopup();
        
        // On récupère toutes les barres de titre
        let headers = document.querySelectorAll('.card-header');
        
        // On regarde si au moins une carte est ouverte
        let isAnyOpen = false;
        headers.forEach(h => {
            if (!h.parentElement.classList.contains('collapsed')) {
                isAnyOpen = true;
            }
        });

        // On simule un VRAI clic de souris sur les barres
        headers.forEach(header => {
            let isClosed = header.parentElement.classList.contains('collapsed');
            
            if (isAnyOpen && !isClosed) {
                // On ferme celles qui sont ouvertes
                header.click();
            } else if (!isAnyOpen && isClosed) {
                // On rouvre celles qui sont fermées (puisqu'elles sont toutes fermées)
                header.click();
            }
        });

        // LA MAGIE : On force les cartes et les graphiques à se redessiner 
        // une fraction de seconde plus tard pour éviter qu'ils ne soient "cassés" au réveil !
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
            if (typeof map360Instance !== 'undefined' && map360Instance) {
                map360Instance.invalidateSize();
            }
        }, 150);
    }
});

// (clearSpecific est déjà défini plus haut dans le fichier, fusionné avec la gestion des fichiers FTF — doublon supprimé)

// (nettoyerTexteGeocaching est déjà défini plus haut dans le fichier — doublon supprimé)

// === GESTION DU THEME SOMBRE (CORRECTION GRAPHIQUES) ===
function applyTheme(isDark) {
    if (isDark) { document.body.classList.add('dark-mode'); } 
    else { document.body.classList.remove('dark-mode'); }

    if (typeof Chart !== 'undefined') {
        const textColor = isDark ? '#ffffff' : '#1e293b'; 
        const gridColor = isDark ? '#334155' : '#e2e8f0';
        Chart.defaults.color = textColor;
        Chart.defaults.font.size = 13;

        Object.values(Chart.instances).forEach(chart => {
            chart.options.color = textColor;
            if (!chart.options.scales) chart.options.scales = {};

            if (chart.config.type !== 'polarArea' && chart.config.type !== 'radar') {
                if (!chart.options.scales.x) chart.options.scales.x = { ticks: {}, grid: {} };
                chart.options.scales.x.ticks.color = textColor;
                chart.options.scales.x.grid.color = gridColor;

                if (!chart.options.scales.y) chart.options.scales.y = { ticks: {}, grid: {} };
                chart.options.scales.y.ticks.color = textColor;
                chart.options.scales.y.grid.color = gridColor;
            } else {
                if (chart.options.scales.x) delete chart.options.scales.x;
                if (chart.options.scales.y) delete chart.options.scales.y;

                if (!chart.options.scales.r) chart.options.scales.r = { ticks: {}, pointLabels: {}, grid: {} };
                chart.options.scales.r.ticks.color = isDark ? '#ffffff' : '#475569';
                chart.options.scales.r.ticks.backdropColor = isDark ? '#1e293b' : '#ffffff';
                chart.options.scales.r.pointLabels.color = textColor;
                chart.options.scales.r.pointLabels.font = { size: 14, weight: 'bold' };
                chart.options.scales.r.grid.color = gridColor;
            }

            if (!chart.options.plugins) chart.options.plugins = { legend: { labels: {} } };
            chart.options.plugins.legend.labels.color = textColor;
            chart.update();
        });
    }
}

function toggleDarkMode() {
    const isDark = !document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark);
    applyTheme(isDark);
}

// Initialise le thème au chargement
window.addEventListener('load', () => {
    const isDark = localStorage.getItem('darkMode') === 'true';
    applyTheme(isDark);
});


// =====================================================================
// === MODULE CARTES CHOROPLÈTHES DYNAMIQUES (GOOGLE GEOCHARTS) ========
// =====================================================================

let googleChartsReady = false;
let pendingGeoCallbacks = [];

if (typeof google !== 'undefined') {
    google.charts.load('current', { 'packages': ['geochart'], 'language': 'fr' });
    google.charts.setOnLoadCallback(() => {
        googleChartsReady = true;
        pendingGeoCallbacks.forEach(cb => cb());
        pendingGeoCallbacks = [];
    });
}

// Google callback replaced — now calls immediately for Leaflet
function appellerQuandGooglePret(fn) {
    if (googleChartsReady) { fn(); } else { pendingGeoCallbacks.push(fn); }
}

function getNomPaysFR(c) {
    const dict = { "Belgium": "Belgique", "Germany": "Allemagne", "Netherlands": "Pays-Bas", "United Kingdom": "Royaume-Uni", "Switzerland": "Suisse", "Spain": "Espagne", "Italy": "Italie", "United States": "États-Unis", "Sweden": "Suède", "Norway": "Norvège", "Finland": "Finlande", "Denmark": "Danemark", "Poland": "Pologne", "Czechia": "Tchéquie", "Ireland": "Irlande" };
    return dict[c] || c;
}

// 1️⃣ NORMALISATION DU PAYS (Comme recommandé par l'IA)
function getGoogleCountryName(c) {
    const dict = { "Belgique": "Belgium", "Allemagne": "Germany", "Pays-Bas": "Netherlands", "Royaume-Uni": "United Kingdom", "Suisse": "Switzerland", "Espagne": "Spain", "Italie": "Italy", "États-Unis": "United States", "USA": "United States", "Suède": "Sweden", "Norvège": "Norway", "Finlande": "Finland", "Danemark": "Denmark", "Pologne": "Poland", "Tchéquie": "Czechia", "Irlande": "Ireland" };
    return dict[c] || c;
}

function getIsoForZoom(c) {
    const dict = { "France": "FR", "Belgium": "BE", "Belgique": "BE", "Germany": "DE", "Netherlands": "NL", "United Kingdom": "GB", "Switzerland": "CH", "Spain": "ES", "Italy": "IT", "United States": "US", "Canada": "CA" };
    return dict[c] || c;
}

function normaliserPourComparaison(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_'\u2019\u02BC]/g, " ").replace(/\s+/g, " ").trim();
}

// 2️⃣ LE MAPPING INTELLIGENT (Avec Fallback Universel)
function getGoogleRegionName(country, state) {
    if (!state) return state;
    let s = state.trim();
    let sNorm = normaliserPourComparaison(s);
    let cNorm = getGoogleCountryName(country);

    // ===== FRANCE : Codes Legacy (FR-F, FR-J...) =====
    if (cNorm === 'France') {
        const frMap = { "nouvelle aquitaine": "FR-B", "auvergne rhone alpes": "FR-V", "bourgogne franche comte": "FR-D", "bretagne": "FR-E", "centre val de loire": "FR-F", "corse": "FR-H", "grand est": "FR-M", "hauts de france": "FR-O", "ile de france": "FR-J", "normandie": "FR-P", "occitanie": "FR-K", "pays de la loire": "FR-R", "provence alpes cote d azur": "FR-U", "paca": "FR-U", "aquitaine": "FR-B", "auvergne": "FR-C", "rhone alpes": "FR-V", "bourgogne": "FR-D", "franche comte": "FR-I", "alsace": "FR-A", "champagne ardenne": "FR-G", "lorraine": "FR-M", "nord pas de calais": "FR-O", "picardie": "FR-S", "haute normandie": "FR-Q", "basse normandie": "FR-P", "languedoc roussillon": "FR-K", "midi pyrenees": "FR-N", "limousin": "FR-L", "poitou charentes": "FR-T", "centre": "FR-F" };
        return frMap[sNorm] || s;
    }

    // ===== BELGIQUE : Noms Anglais (Walloon Brabant...) =====
    if (cNorm === 'Belgium') {
        const beMap = { "bruxelles": "Brussels", "brussels": "Brussels", "region de bruxelles capitale": "Brussels", "bruxelles capitale": "Brussels", "brabant wallon": "Walloon Brabant", "hainaut": "Hainaut", "liege": "Liège", "province de liege": "Liège", "luxembourg": "Luxembourg", "luxembourg be": "Luxembourg", "namur": "Namur", "brabant flamand": "Flemish Brabant", "vlaams brabant": "Flemish Brabant", "anvers": "Antwerp", "antwerp": "Antwerp", "limbourg": "Limburg", "limburg": "Limburg", "flandre orientale": "East Flanders", "oost vlaanderen": "East Flanders", "flandre occidentale": "West Flanders", "west vlaanderen": "West Flanders" };
        return beMap[sNorm] || s;
    }

    // ===== USA : Noms Anglais (Si GPX en Français) =====
    if (cNorm === 'United States') {
        const usMap = { "californie": "California", "caroline du nord": "North Carolina", "caroline du sud": "South Carolina", "dakota du nord": "North Dakota", "dakota du sud": "South Dakota", "floride": "Florida", "georgie": "Georgia", "hawai": "Hawaii", "louisiane": "Louisiana", "nouveau mexique": "New Mexico", "pennsylvanie": "Pennsylvania", "virginie": "Virginia", "virginie occidentale": "West Virginia" };
        return usMap[sNorm] || s;
    }

    // ===== ALLEMAGNE : Noms Anglais =====
    if (cNorm === 'Germany') {
        const deMap = { "bade wurtemberg": "Baden-Württemberg", "baviere": "Bavaria", "breme": "Bremen", "hambourg": "Hamburg", "hesse": "Hesse", "mecklembourg pomranie": "Mecklenburg-Vorpommern", "basse saxe": "Lower Saxony", "rhenanie du nord westphalie": "North Rhine-Westphalia", "rhenanie palatinat": "Rhineland-Palatinate", "sarre": "Saarland", "saxe": "Saxony", "saxe anhalt": "Saxony-Anhalt", "thuringe": "Thuringia" };
        return deMap[sNorm] || s;
    }

    // ===== ESPAGNE : Noms Anglais =====
    if (cNorm === 'Spain') {
        const esMap = { "andalousie": "Andalusia", "aragon": "Aragon", "asturies": "Asturias", "iles baleares": "Balearic Islands", "baleares": "Balearic Islands", "pays basque": "Basque Country", "iles canaries": "Canary Islands", "canaries": "Canary Islands", "cantabrie": "Cantabria", "castille la manche": "Castile-La Mancha", "castille leon": "Castile and León", "catalogne": "Catalonia", "extremadure": "Extremadura", "galice": "Galicia", "madrid": "Community of Madrid", "murcie": "Murcia", "navarre": "Navarre", "valence": "Valencian Community" };
        return esMap[sNorm] || s;
    }

    // ===== ITALIE : Noms Anglais =====
    if (cNorm === 'Italy') {
        const itMap = { "abruzzes": "Abruzzo", "val d aoste": "Aosta Valley", "basilicate": "Basilicata", "calabre": "Calabria", "campanie": "Campania", "emilie romagne": "Emilia-Romagna", "frioul venetie julienne": "Friuli Venezia Giulia", "latium": "Lazio", "ligurie": "Liguria", "lombardie": "Lombardy", "marches": "Marche", "piemont": "Piedmont", "pouilles": "Apulia", "sardaigne": "Sardinia", "sicile": "Sicily", "toscane": "Tuscany", "trentin haut adige": "Trentino-Alto Adige", "ombrie": "Umbria", "venetie": "Veneto" };
        return itMap[sNorm] || s;
    }

    // ⭐ FALLBACK UNIVERSEL : Si le pays n'est pas dans cette liste (ex: Brésil, Japon...), 
    // on retourne simplement le nom original. Google le comprendra. PAS BESOIN DE GROS FICHIER !
    return s;
}

const TOTAL_REGIONS = { "France": 13, "Belgium": 11, "Belgique": 11, "Germany": 16, "Allemagne": 16, "United States": 50, "États-Unis": 50, "Canada": 13, "Switzerland": 26, "Suisse": 26, "Spain": 17, "Espagne": 17, "Netherlands": 12, "Pays-Bas": 12, "United Kingdom": 4, "Royaume-Uni": 4 };

var activeMapTab = 'world';


// ────────────────────────────────────────────────────────────────────
// LEAFLET MAP SYSTEM — Universel, fonctionne pour TOUS les pays
// ────────────────────────────────────────────────────────────────────
let leafletMaps = {};   // { mapId: L.map instance }
let leafletLayers = {}; // { mapId: { regionId: L.polygon } }
let leafletLegend = {}; // { mapId: legend control }

const COLOR_SCALE_FIND = ['#dcfce7','#86efac','#22c55e','#15803d','#14532d'];
const COLOR_SCALE_FTF  = ['#fef9c3','#fde047','#f59e0b','#b45309','#78350f'];
const COLOR_SCALE_WORLD = ['#bfdbfe','#3b82f6','#1d4ed8','#1e3a8a'];

function interpColor(val, min, max, scale) {
    if (max <= min) return scale[0];
    let t = Math.max(0, Math.min(1, (val - min) / (max - min)));
    let idx = Math.floor(t * (scale.length - 1));
    return scale[idx];
}

function formatCount(n) { return n >= 1000 ? (n/1000).toFixed(1)+'k' : String(n); }

function getRegionNameForCountry(feature, countryKey) {
    const props = feature.get('properties') || feature.properties || {};
    const candidates = [
        props['nom'], props['name'], props['NAME'],
        props['region'], props['province'], props['PROVINCE'],
        props['departement'], props['DEPARTEMENT'],
        props['name_en'], props['name_fr']
    ];
    for (let c of candidates) { if (c) return String(c).trim(); }
    return null;
}

function getRegionCode(feature) {
    const props = feature.get('properties') || feature.properties || {};
    return props['code'] || props['Code'] || props['ISO'] || props['id'] || null;
}

function styleRegion(feature, counts, maxVal, scale) {
    const name = getRegionNameForCountry(feature, '');
    const code = getRegionCode(feature);
    const count = counts[name] || counts[code] || 0;
    const color = count > 0 ? interpColor(count, 0, maxVal, scale) : '#e2e8f0';
    return { fillColor: color, color: '#fff', weight: 1.5, fillOpacity: 0.8, opacity: 0.7 };
}

function onEachFeature(feature, layer, counts, maxVal) {
    const name = getRegionNameForCountry(feature, '') || '?';
    const code = getRegionCode(feature);
    const count = counts[name] || counts[code] || 0;
    const pct = maxVal > 0 ? ((count / maxVal) * 100).toFixed(1) : '0';
    layer.bindPopup(`<b>📍 ${name}</b><br>Trouvailles : <b>${count}</b><br>${pct}% du total`);
    layer.on({ mouseover: () => layer.setStyle({ weight: 3, fillOpacity: 0.9 }),
               mouseout:  () => layer.setStyle({ weight: 1.5, fillOpacity: 0.8 }) });
}

function loadGeoJsonForCountry(containerId, countryKey, counts, maxVal, scale, centerCoords, zoom) {
    // Remove existing map
    if (leafletMaps[containerId]) {
        leafletMaps[containerId].remove();
        delete leafletMaps[containerId];
    }

    let geoJsonUrl = null;
    const isDark = document.body.classList.contains('dark-mode');
    const bgColor = isDark ? '#1e293b' : '#e0f2fe';

    if (countryKey === 'France' || countryKey === 'france') {
        geoJsonUrl = 'regions-france.geojson';
    } else if (/belgi/i.test(countryKey)) {
        geoJsonUrl = null; // Will draw world map fallback for Belgium
    } else {
        geoJsonUrl = null;
    }

    const mapEl = document.getElementById(containerId);
    if (!mapEl) return;

    // Force container to have explicit dimensions
    mapEl.style.width = '100%';
    mapEl.style.maxWidth = '700px';
    mapEl.style.height = '420px';
    mapEl.style.borderRadius = '12px';
    mapEl.style.border = '1px solid var(--border)';
    mapEl.style.overflow = 'hidden';
    mapEl.style.margin = '0 auto';
    mapEl.style.background = bgColor;

    const map = L.map(containerId, {
        center: centerCoords || [46.6, 2.5],
        zoom: zoom || 6,
        minZoom: 4,
        maxZoom: 10,
        zoomControl: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 18
    }).addTo(map);
    leafletMaps[containerId] = map;

    if (geoJsonUrl) {
        fetch(geoJsonUrl)
            .then(r => r.json())
            .then(geoData => {
                const layer = L.geoJson(geoData, {
                    style: f => styleRegion(f, counts, maxVal, scale),
                    onEachFeature: (f, l) => onEachFeature(f, l, counts, maxVal)
                }).addTo(map);
                if (!leafletLayers[containerId]) leafletLayers[containerId] = {};
                map.fitBounds(layer.getBounds(), { padding: [20, 20] });

                // Add legend
                addLeafletLegend(map, containerId, scale, counts, maxVal);
            })
            .catch(e => { console.warn('GeoJSON load failed for', countryKey, e); drawFallbackMap(map, countryKey, counts, maxVal, scale); });
    } else {
        drawFallbackMap(map, countryKey, counts, maxVal, scale);
    }
}

function drawFallbackMap(map, countryKey, counts, maxVal, scale) {
    // For countries without detailed GeoJSON, show a simple marker-based map
    const isDark = document.body.classList.contains('dark-mode');
    const markers = [];
    for (let [name, cnt] of Object.entries(counts)) {
        if (cnt > 0) {
            const color = interpColor(cnt, 0, maxVal, scale);
            const c = L.circleMarker([46.5 + Math.random()*8, 2 + Math.random()*12], {
                radius: Math.max(6, Math.min(25, cnt / 2)),
                fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.85
            }).bindPopup(`<b>${name}</b> : ${cnt} trouvailles`).addTo(map);
            markers.push(c);
        }
    }
    if (markers.length > 0) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
    }
}

function addLeafletLegend(map, containerId, scale, counts, maxVal) {
    if (leafletLegend[containerId]) { map.removeControl(leafletLegend[containerId]); }
    const isDark = document.body.classList.contains('dark-mode');
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-legend');
        div.style.cssText = 'background:white; padding:10px 14px; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.15); font-size:12px; font-family:system-ui;';
        div.innerHTML = `<div style="font-weight:700; margin-bottom:6px;">Légende</div>
            <div style="display:flex; align-items:center; gap:4px;"><span>Peu</span>
            <div style="display:flex; gap:1px;">
                ${scale.map(c => `<span style="width:16px;height:12px;background:${c};border-radius:2px;"></span>`).join('')}
            </div><span>Beaucoup</span></div>
            <div style="margin-top:4px;color:#64748b;font-size:11px;">Max: ${maxVal}</div>`;
        return div;
    };
    legend.addTo(map);
    leafletLegend[containerId] = legend;
}

function drawWorldMap(containerId, locationsData, scale) {
    const isDark = document.body.classList.contains('dark-mode');
    const mapEl = document.getElementById(containerId);
    if (!mapEl) return;
    mapEl.style.cssText = 'width:100%;max-width:650px;height:350px;border-radius:12px;border:1px solid var(--border);overflow:hidden;margin:0 auto;background:#e0f2fe;';

    if (leafletMaps[containerId]) { leafletMaps[containerId].remove(); delete leafletMaps[containerId]; }

    const map = L.map(containerId, { center: [20, 10], zoom: 2, minZoom: 1, maxZoom: 7 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    leafletMaps[containerId] = map;

    const countries = Object.keys(locationsData).filter(c => c !== 'Inconnu' && locationsData[c].count > 0);
    countries.forEach(c => {
        const cnt = locationsData[c].count;
        const color = interpColor(cnt, 0, locationsData['France']?.count || 10, scale);
        const r = L.circleMarker([0, 0], {
            radius: Math.max(5, Math.min(20, cnt / 10)),
            fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.85
        }).bindPopup(`<b>${c}</b> : ${cnt} trouvailles`).addTo(map);
        r.on('click', () => {
            const btn = document.querySelector(`[onclick*="${c.replace(/[^a-zA-Z0-9]/g, '')}"]`);
            if (btn) btn.click();
        });
    });
}

// ─────────────────────────────────────────────────────────────────────
// NEW initCartesDynamiques — uses Leaflet
// ─────────────────────────────────────────────────────────────────────
function initCartesDynamiques(locationsData) {
    if (!locationsData || !document.getElementById('geoMapsCard')) return;
    document.getElementById('geoMapsCard').style.display = 'block';

    const isDark = document.body.classList.contains('dark-mode');
    const scale = COLOR_SCALE_FIND;

    let countries = Object.keys(locationsData).filter(c => c !== 'Inconnu' && locationsData[c].count > 0);
    countries.sort((a, b) => locationsData[b].count - locationsData[a].count);
    let topCountries = countries.slice(0, 5);

    let globalTotal = 0; let allCountriesArr = [];
    countries.forEach(c => { globalTotal += locationsData[c].count; allCountriesArr.push({ name: getNomPaysFR(c), count: locationsData[c].count }); });

    let chipsHtml = allCountriesArr.map(st => {
        let pct = globalTotal > 0 ? ((st.count / globalTotal) * 100).toFixed(1) : 0;
        return `<span class="geo-chip">🚩 ${st.name} <strong>${st.count}</strong> <span style="opacity:0.7">(${pct}%)</span></span>`;
    }).join('');

    let worldSummaryHtml = `
        <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--border, #e2e8f0);">
            <p style="text-align:center; font-size:13px; color:var(--text-muted); margin:0 0 10px;"><strong>${allCountriesArr.length} pays</strong> loggués</p>
            <div class="geo-summary-chips">${chipsHtml}</div>
        </div>`;

    // Country centers for Leaflet: [lat, lon]
    const COUNTRY_CENTERS = {
        'France': [46.6, 2.5], 'france': [46.6, 2.5],
        'Belgium': [50.5, 4.5], 'België': [50.5, 4.5], 'Belgique': [50.5, 4.5],
        'Germany': [51.2, 10.4], 'Allemagne': [51.2, 10.4],
        'United States': [39.8, -98.5], 'États-Unis': [39.8, -98.5], 'USA': [39.8, -98.5],
        'Canada': [56.1, -106.3],
        'Switzerland': [46.8, 8.2], 'Suisse': [46.8, 8.2],
        'Spain': [40.5, -3.7], 'Espagne': [40.5, -3.7],
        'Netherlands': [52.1, 5.3], 'Pays-Bas': [52.1, 5.3],
        'United Kingdom': [55.4, -3.4], 'Royaume-Uni': [55.4, -3.4],
        'Madagascar': [-19.0, 46.7],
    };

    const COUNTRY_ZOOMS = {
        'France': 6, 'france': 6, 'Belgium': 8, 'België': 8, 'Belgique': 8,
        'Germany': 6, 'United States': 4, 'Canada': 4,
        'Switzerland': 8, 'Spain': 6, 'Netherlands': 8, 'United Kingdom': 5,
        'Madagascar': 6, 'default': 6
    };

    let tabsHtml = `<button class="tab-btn ${activeMapTab === 'world' ? 'active' : ''}" data-count="${allCountriesArr.length}" onclick="changerOngletCarte('world')">🌍 Monde</button>`;

    let containersHtml = `
        <div id="tabGeoMap-world" style="display:${activeMapTab === 'world' ? 'block' : 'none'}; padding-top:16px;">
            <div style="display:flex; justify-content:center; flex-wrap:wrap; gap:20px;">
                <div style="flex:1; min-width:300px; max-width:700px;">
                    <h4 style="text-align:center; color:var(--primary); margin:0 0 10px; font-size:14px;">🌐 Carte du Monde</h4>
                    <div id="map_world" style="width:100%;max-width:650px;height:350px;border-radius:12px;overflow:hidden;border:1px solid var(--border);margin:0 auto;background:#e0f2fe;"></div>
                </div>
                <div style="flex:1; min-width:300px; max-width:700px;">
                    <h4 style="text-align:center; color:var(--primary); margin:0 0 10px; font-size:14px;">🇪🇺 Europe</h4>
                    <div id="map_europe" style="width:100%;max-width:650px;height:350px;border-radius:12px;overflow:hidden;border:1px solid var(--border);margin:0 auto;background:#e0f2fe;"></div>
                </div>
            </div>
            ${worldSummaryHtml}
        </div>`;

    topCountries.forEach(c => {
        const safeId = c.replace(/[^a-zA-Z0-9]/g, '');
        const nomPaysAffiche = getNomPaysFR(c);
        let statesArr = Object.keys(locationsData[c].states).filter(s => s && s !== 'Inconnue' && (typeof locationsData[c].states[s] === 'object' ? locationsData[c].states[s].count : locationsData[c].states[s]) > 0).map(s => {
            let stateData = locationsData[c].states[s];
            return { name: s, count: typeof stateData === 'object' ? stateData.count : stateData };
        }).sort((a, b) => b.count - a.count);

        const nbFound = statesArr.length; const nbTotalRegions = TOTAL_REGIONS[nomPaysAffiche] || TOTAL_REGIONS[c] || null;
        const nbTotalStr = nbTotalRegions ? ` / ${nbTotalRegions}` : '';
        const pctRegions = nbTotalRegions ? Math.round((nbFound / nbTotalRegions) * 100) : null;

        let progressHtml = pctRegions !== null ? `<div style="margin: 0 0 12px; display:flex; align-items:center; gap:10px; font-size:12px; color:var(--text-muted); font-weight:700;"><span>${nbFound}${nbTotalStr} régions</span><div style="flex:1; background:#e2e8f0; border-radius:6px; height:8px; overflow:hidden;"><div style="width:${pctRegions}%; height:100%; background:linear-gradient(90deg,#10b981,#047857); border-radius:6px;"></div></div><span>${pctRegions}%</span></div>` : '';

        let regChipsHtml = statesArr.slice(0, 30).map(st => {
            const pct = ((st.count / locationsData[c].count) * 100).toFixed(1);
            let safeStateName = st.name.replace(/'/g, "\'"); let safeCountryName = c.replace(/'/g, "\'");
            return `<span class="geo-chip clickable-chip" onclick="ouvrirModalGeo('${safeCountryName}', '${safeStateName}')" title="Cliquez pour voir les types !">📍 ${st.name} <strong>${st.count}</strong> <span style="opacity:0.7">(${pct}%)</span></span>`;
        }).join('');

        tabsHtml += `<button class="tab-btn ${activeMapTab === safeId ? 'active' : ''}" data-count="${locationsData[c].count}" onclick="changerOngletCarte('${safeId}')">${nomPaysAffiche}</button>`;

        containersHtml += `
        <div id="tabGeoMap-${safeId}" style="display:${activeMapTab === safeId ? 'block' : 'none'}; padding-top:16px;">
            <h4 style="text-align:center; color:var(--primary); margin:0 0 12px; font-size:15px; font-weight:800;">🗺️ ${nomPaysAffiche} — répartition</h4>
            ${progressHtml}
            <div style="display:flex; justify-content:center;"><div id="map_${safeId}" style="width:100%;max-width:700px;height:420px;border-radius:12px;overflow:hidden;border:1px solid var(--border);background:#e0f2fe;"></div></div>
            <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border,#e2e8f0);">
                <p style="text-align:center; font-size:12px; color:var(--text-muted); margin:0 0 10px; font-weight:700;">Top régions (${statesArr.length}${nbTotalStr}) — 👆 Cliquez sur les badges pour le détail</p>
                <div class="geo-summary-chips">${regChipsHtml}</div>
            </div>
        </div>`;
    });

    document.getElementById('dynamicMapTabs').innerHTML = tabsHtml;
    document.getElementById('dynamicMapContainers').innerHTML = containersHtml;

    // Draw maps immediately (Leaflet is synchronous)
    setTimeout(() => {
        // World map
        drawWorldMap('map_world', locationsData, scale);
        // Europe map
        const europeMap = L.map('map_europe', { center: [50, 8], zoom: 4, minZoom: 3, maxZoom: 8 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(europeMap);
        leafletMaps['map_europe'] = europeMap;
        // Country maps
        topCountries.forEach(c => {
            const safeId = c.replace(/[^a-zA-Z0-9]/g, '');
            const mapId = `map_${safeId}`;
            const center = COUNTRY_CENTERS[c] || COUNTRY_CENTERS[nomPaysAffiche] || COUNTRY_CENTERS['default'];
            const zoom = COUNTRY_ZOOMS[c] || COUNTRY_ZOOMS[nomPaysAffiche] || COUNTRY_ZOOMS['default'];

            // Build counts dict
            let counts = {};
            let maxVal = 0;
            for (let state in locationsData[c].states) {
                if (state && state !== 'Inconnue') {
                    let cnt = typeof locationsData[c].states[state] === 'object' ? locationsData[c].states[state].count : locationsData[c].states[state];
                    if (cnt > 0) { counts[state] = cnt; maxVal = Math.max(maxVal, cnt); }
                }
            }
            if (Object.keys(counts).length > 0) {
                loadGeoJsonForCountry(mapId, c, counts, maxVal, scale, center, zoom);
            }
        });
    }, 100);
}


function changerOngletCarte(tabId) { activeMapTab = tabId; initCartesDynamiques(window.lastLocationsData); }

function dessinerCartesActive(locationsData, topCountries) { /* Leaflet maps drawn in initCartesDynamiques */ }

function dessinerCarteFTFDynamique(ftfList) {
    const mapEl = document.getElementById('map_ftf_dynamic');
    if (!ftfList || ftfList.length === 0 || !mapEl) return;

    const scale = COLOR_SCALE_FTF;
    let ftfCountsByCountry = {}; ftfList.forEach(ftf => { if (ftf.country && ftf.country !== 'Inconnu') ftfCountsByCountry[ftf.country] = (ftfCountsByCountry[ftf.country] || 0) + 1; });
    let topCountry = Object.keys(ftfCountsByCountry).sort((a, b) => ftfCountsByCountry[b] - ftfCountsByCountry[a])[0];
    if (!topCountry) return;

    let locs = {}; ftfList.forEach(ftf => { if (ftf.country === topCountry && ftf.state && ftf.state !== 'Inconnue') locs[ftf.state] = (locs[ftf.state] || 0) + 1; });
    let maxVal = Math.max(...Object.values(locs), 1);

    mapEl.style.cssText = 'width:100%;max-width:700px;height:420px;border-radius:12px;border:1px solid var(--border);overflow:hidden;margin:0 auto;background:#fef9c3;';

    const COUNTRY_CENTERS_FTF = {
        'France': [46.6, 2.5], 'Belgium': [50.5, 4.5], 'Germany': [51.2, 10.4],
        'United States': [39.8, -98.5], 'default': [46, 2]
    };
    const center = COUNTRY_CENTERS_FTF[topCountry] || COUNTRY_CENTERS_FTF['default'];
    
    if (leafletMaps['map_ftf_dynamic']) { leafletMaps['map_ftf_dynamic'].remove(); delete leafletMaps['map_ftf_dynamic']; }
    const map = L.map('map_ftf_dynamic', { center: center, zoom: 6, minZoom: 4, maxZoom: 10 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    leafletMaps['map_ftf_dynamic'] = map;

    // Load France GeoJSON for FTF
    if (topCountry === 'France' || /france/i.test(topCountry)) {
        fetch('regions-france.geojson')
            .then(r => r.json())
            .then(geoData => {
                const layer = L.geoJson(geoData, {
                    style: f => styleRegion(f, locs, maxVal, scale),
                    onEachFeature: (f, l) => onEachFeature(f, l, locs, maxVal)
                }).addTo(map);
                map.fitBounds(layer.getBounds().pad(0.2));
                addLeafletLegend(map, 'map_ftf_dynamic', scale, locs, maxVal);
            })
            .catch(() => drawFallbackMap(map, topCountry, locs, maxVal, scale));
    } else {
        drawFallbackMap(map, topCountry, locs, maxVal, scale);
    }
}

// =====================================================================
// === GÉNÉRATEUR DE SCRIPT LUA PROJECT-GC =============================
// =====================================================================

function genererCodeLua() {
    const limit = parseInt(document.getElementById('chkLimit').value) || 20;
    const keyword = document.getElementById('chkKeyword').value.trim();
    const country = document.getElementById('chkCountry').value.trim();
    const region = document.getElementById('chkRegion').value.trim();
    const minD = parseFloat(document.getElementById('chkMinD').value) || null;
    const minT = parseFloat(document.getElementById('chkMinT').value) || null;
    const hiddenFrom = document.getElementById('chkHiddenFrom').value;
    const hiddenTo = document.getElementById('chkHiddenTo').value;

    const selectedSizes = [...document.querySelectorAll('.chk-size:checked')].map(cb => `"${cb.value}"`);
    const selectedTypes = [...document.querySelectorAll('.chk-type:checked')].map(cb => `"${cb.value}"`);

    // Construction du filtre
    let filterParts = [];
    if (selectedTypes.length > 0 && selectedTypes.length < 12) {
        filterParts.push(`    types = { ${selectedTypes.join(', ')} }`);
    }
    if (selectedSizes.length > 0 && selectedSizes.length < 7) {
        filterParts.push(`    container = { ${selectedSizes.join(', ')} }`);
    }
    if (country) filterParts.push(`    country = "${country}"`);
    if (region) filterParts.push(`    region = "${region}"`);
    if (minD) filterParts.push(`    mindifficulty = ${minD}`);
    if (minT) filterParts.push(`    minterrain = ${minT}`);
    if (hiddenFrom) filterParts.push(`    placedFrom = "${hiddenFrom}"`);
    if (hiddenTo) filterParts.push(`    placedTo = "${hiddenTo}"`);

    let filterBlock = filterParts.length > 0 
        ? `{\n${filterParts.join(',\n')}\n  }` 
        : '{}';

    let keywordCheck = keyword 
        ? `
  -- Filtre sur le mot-clé dans le titre
  local kw = string.lower("${keyword.replace(/"/g, '\\"')}")
  if not string.find(string.lower(v.cache_name or ""), kw, 1, true) then
    goto continue
  end`
        : '';

    let lua = `-- ============================================================
-- Challenge Checker généré par Dashboard Geocaching Master Pro
-- Critères : ${limit} caches requises
-- ============================================================

local args = {...}
local conf = args[1].config
local profileName = args[1]['profileName']

local profileId = PGC.ProfileName2Id(profileName)
PGC.print('Profil : ', profileName, ' (ID: ', profileId, ')\\n')

local filter = ${filterBlock}

local finds = PGC.GetFinds(profileId, {
  fields = { 'gccode', 'cache_name', 'type', 'container', 'difficulty', 'terrain', 'country', 'region', 'visitdate' },
  filter = filter
})

PGC.print(#finds, ' logs récupérés\\n')

local validFinds = {}
local seen = {}

for _, v in ipairs(finds) do
  -- Déduplication par code GC
  if seen[v.gccode] then goto continue end
  seen[v.gccode] = true
${keywordCheck}
  table.insert(validFinds, v)
  ::continue::
end

local count = #validFinds
local ok = count >= ${limit}

local html = ""
local log = false

if ok then
  html = "✅ Challenge réussi ! <b>" .. count .. " / ${limit}</b> caches valides trouvées.<br>"
  log = "Challenge réussi : " .. count .. " / ${limit} caches."
else
  html = "⏳ Progression : <b>" .. count .. " / ${limit}</b> caches valides.<br>"
end

-- Détail par type de cache
local typeCount = {}
for _, v in ipairs(validFinds) do
  local t = v.type or "Autre"
  typeCount[t] = (typeCount[t] or 0) + 1
end

html = html .. "<br><b>Répartition par type :</b><br>"
for t, n in pairs(typeCount) do
  html = html .. "&nbsp;&nbsp;• " .. t .. " : " .. n .. "<br>"
end

return { ok = ok, log = log, html = html }
`;

    document.getElementById('luaOutput').value = lua;
}

function genererBadgeHtml() {
    const gcCode = document.getElementById('chkGCCode').value.trim();
    const checkerId = document.getElementById('chkID').value.trim();

    if (!gcCode || !checkerId) {
        alert('Veuillez entrer le Code GC et l\'ID Checker.');
        return;
    }

    const imgUrl = `https://project-gc.com/challenges/${gcCode}/${checkerId}`;
    const html = `<a href="${imgUrl}" target="_blank"><img src="${imgUrl}.png" alt="Challenge Checker Badge" /></a>`;
    document.getElementById('luaOutput').value = html;
}

function copierCodeLua() {
    const output = document.getElementById('luaOutput');
    if (!output.value) { alert('Rien à copier ! Générez d\'abord un script.'); return; }
    navigator.clipboard.writeText(output.value).then(() => {
        let btn = event.currentTarget;
        let origText = btn.innerHTML;
        btn.innerHTML = '✅ Copié !';
        btn.style.background = '#059669';
        setTimeout(() => { btn.innerHTML = origText; btn.style.background = '#10b981'; }, 2000);
    }).catch(() => {
        output.select();
        document.execCommand('copy');
        alert('✅ Copié dans le presse-papiers !');
    });
}