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
    // Confirmation avant de supprimer
    if (!confirm("⚠️ Attention : Cela va supprimer les fichiers GPX/TXT chargés.\n\nTes réglages (Pseudo et Domicile) seront conservés.\n\nContinuer ?")) {
        return;
    }

    // 1. Définir les clés que nous voulons GARDER (ne pas supprimer)
    const keysToPreserve = ['userPseudo', 'userHome'];

    // 2. Parcourir toutes les clés du localStorage en partant de la fin
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        
        // 3. Supprimer uniquement si la clé n'est PAS dans notre liste de protection
        if (!keysToPreserve.includes(key)) {
            localStorage.removeItem(key);
        }
    }

    // 4. Recharger la page pour remettre le Dashboard à zéro proprement
    location.reload();
}

document.getElementById('gpxInput').addEventListener('change', e => {
    if (!e.target.files[0]) return;
    document.getElementById('gpxBtn').innerHTML = "⏳ Analyse en cours...";
    const reader = new FileReader();
    reader.onload = ev => traiterGPX(ev.target.result);
    reader.readAsText(e.target.files[0]);
});

document.getElementById('csvInput').addEventListener('change', e => {
    if (!e.target.files[0]) return;
    document.getElementById('csvBtn').innerHTML = "⏳ Analyse en cours...";
    const reader = new FileReader();
    reader.onload = ev => traiterLabs(ev.target.result);
    reader.readAsText(e.target.files[0]);
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
});

document.getElementById('draftInput').addEventListener('change', e => {
    if (!e.target.files[0]) return;
    document.getElementById('draftBtn').innerHTML = "⏳ Analyse en cours...";
    const reader = new FileReader();
    reader.onload = ev => traiterGPX(ev.target.result, true); // Le "true" active la magie du prévisionnel
    reader.readAsText(e.target.files[0]);
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
            const gcCode = wpt.getElementsByTagNameNS("*", "name")[0]?.textContent || "";
            const lat = parseFloat(wpt.getAttribute("lat"));
            const lon = parseFloat(wpt.getAttribute("lon"));
            
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
                // === LECTURE NORMALE ===
                const logs = wpt.getElementsByTagNameNS("*", "log");
                for (let i = 0; i < logs.length; i++) {
                    const finderNode = logs[i].getElementsByTagNameNS("*", "finder")[0];
                    const finder = finderNode ? finderNode.textContent.trim().toLowerCase() : "";
                    
                    if (pseudo === "" || finder === pseudo) {
                        const logType = logs[i].getElementsByTagNameNS("*", "type")[0]?.textContent || "";
                        if (["found it", "attended", "webcam photo taken"].includes(logType.toLowerCase())) {
                            const dateTrouvaille = logs[i].getElementsByTagNameNS("*", "date")[0]?.textContent;
                            const logText = logs[i].getElementsByTagNameNS("*", "text")[0]?.textContent || "";
                            const isFTF = /\{\*FTF\*\}|\{FTF\}|\[FTF\]/i.test(logText);
                            
                            if (dateTrouvaille) {
                                const dateCourte = getGeocachingDate(dateTrouvaille);
                                if (dateCourte) {
                                    if (!tGpx.days[dateCourte]) tGpx.days[dateCourte] = { total: 0, physiques: 0, typesDetail: {} };
                                    tGpx.days[dateCourte].total++;
                                    tGpx.days[dateCourte].physiques++;
                                    tGpx.days[dateCourte].typesDetail[type] = (tGpx.days[dateCourte].typesDetail[type] || 0) + 1;
                                    countLogTrouve++;
                                    if (isFTF) {
                                        tGpx.ftfCount++;
                                        tGpx.ftfList.push({ date: dateCourte, name: cacheName, gcCode: gcCode });
                                    }
                                }
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
                    tGpx.geo.push({lat: lat, lon: lon, count: countLogTrouve, gcCode: gcCode});
                }
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
    let fs = { totaux: { physiques: 0, labs: 0, global: 0 }, types: {}, sizes: {}, dt: {}, days: {}, geo: [], ftfList: [] };

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
        
        if (src.geo) fs.geo = fs.geo.concat(src.geo);
        if (src.ftfList) fs.ftfList = fs.ftfList.concat(src.ftfList);
        
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
        if (fs.geo && fs.geo.length > 0) { 
            window.lastGeoData = fs.geo; // On sauvegarde les données pour le curseur
            generer360(fs.geo); 
        }
        genererPaliers(fs.days);
        genererRadarHabitudes(fs.days);
    }

    genererGrille366(fs.days);
    genererMatrice(fs.dt); 
    genererGraphesTypes(fs);
    genererTop50(fs.days);
    genererAgenda(fs.days);
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
                        ctx.fillStyle = "#475569";
                        ctx.textAlign = "center";
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
        initialView: 'dayGridMonth', locale: 'fr', firstDay: 1, height: '100%',
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

// === NOUVEAUTÉ : PALIERS (MILESTONES) ===
function genererPaliers(daysData) {
    const milestonesDef = [100, 500, 1000, 1500, 2000, 2500, 3000, 4000, 5000];
    let runningTotal = 0;
    let msIndex = 0;
    let html = '';
    
    const sortedDates = Object.keys(daysData).sort();
    for(let d of sortedDates) {
        runningTotal += daysData[d].total;
        while(msIndex < milestonesDef.length && runningTotal >= milestonesDef[msIndex]) {
            const dateFr = d.split('-').reverse().join('/');
            html += `
            <div class="milestone-item">
                <div class="milestone-icon">🏅</div>
                <div class="milestone-count">${milestonesDef[msIndex]}</div>
                <div class="milestone-date">Atteint le ${dateFr}</div>
            </div>`;
            msIndex++;
        }
    }
    if(document.getElementById('milestonesList')) document.getElementById('milestonesList').innerHTML = html || "<p style='color:#888; font-style:italic;'>En route vers ton premier palier !</p>";
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

function generer360(geoData) {
    let coordsInput = document.getElementById('homeCoords');
    if(!coordsInput) return;
    
    let target360 = parseInt(document.getElementById('target360Slider').value) || 1;
    let coordsObj = parseGeocachingCoords(coordsInput.value);
    const homeLat = coordsObj.lat;
    const homeLon = coordsObj.lon;

    let sectors = new Array(360).fill(0);
    let cachesPerSector = Array.from({length: 360}, () => []);

    // 1. Calcul et limitation stricte à 5 caches par secteur
    geoData.forEach(c => {
        let brng = calculerAzimut(homeLat, homeLon, c.lat, c.lon);
        let sector = Math.floor(brng);
        if(sector === 360) sector = 0;
        
        let spaceLeft = 5 - sectors[sector];
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

    // 2. NOUVEAU GRAPHIQUE RADAR POLAIRE (Façon Project-GC)
    let dataPoints = sectors.map(s => s === 0 ? 0.3 : s);
    let bgColors = sectors.map(s => s >= target360 ? 'rgba(16, 185, 129, 0.8)' : (s > 0 ? 'rgba(245, 158, 11, 0.8)' : 'rgba(239, 68, 68, 0.8)'));
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
                        min: 0, max: 5,
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
        map360Instance = L.map('tab360-carte').setView([homeLat, homeLon], 11);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' }).addTo(map360Instance);
        map360Instance.on('zoomend', updateMapPremium);
    } else {
        map360Instance.setView([homeLat, homeLon], map360Instance.getZoom());
    }
    updateMapPremium();
}

// === NOUVELLE FONCTION POUR LE CURSEUR 360 (Fluide et sans bug) ===
function update360Target() {
    let val = document.getElementById('target360Slider').value;
    document.getElementById('target360Val').innerText = val;
    if (window.lastGeoData) {
        generer360(window.lastGeoData); // Ne recalcule QUE le 360 !
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

    // Vérification du zoom minimum
    if (currentZoom < 10) {
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

    // Dessiner les lignes de degrés
    for (let i = 0; i < 360; i += 10) {
        let p = getDestinationPoint(homeLat, homeLon, i, 80);
        L.polyline([[homeLat, homeLon], p], {color: 'rgba(255,255,255,0.3)', weight: 1, dashArray: '5,5'}).addTo(mapGridLayer);
        let icon = L.divIcon({className: 'degree-label', html: `<div style="color:white; font-weight:bold; font-size:11px; text-shadow: 1px 1px 3px black;">${i}°</div>`, iconSize: [30, 15]});
        L.marker(p, {icon: icon}).addTo(mapGridLayer);
    }

    // Affichage des secteurs
    if (showAll) {
        // Mode "Tout voir" : dessine tous les secteurs trouvés
        sectorDataGlobal.forEach((s, i) => {
            if(s.count > 0) {
                let p1 = getDestinationPoint(homeLat, homeLon, i, 80);
                let p2 = getDestinationPoint(homeLat, homeLon, i + 1, 80);
                L.polygon([[homeLat, homeLon], p1, p2], {color: '#10b981', weight: 0.5, fillOpacity: 0.2}).addTo(mapGridLayer);
            }
        });
    } else {
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
                    if (cachesToShow.caches.includes(c.gcCode) && drawnCount < 5) {
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

function genererFTFList(ftfList) {
    const tBody = document.getElementById('ftfTableBody');
    if(document.getElementById('kpiFtf')) document.getElementById('kpiFtf').innerText = ftfList ? ftfList.length : 0;
    if(document.getElementById('ftfBadgeTotal')) document.getElementById('ftfBadgeTotal').innerText = `${ftfList ? ftfList.length : 0} FTF`;
    
    if (!ftfList || ftfList.length === 0) {
        if(tBody) tBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#888;">Aucun FTF détecté. Utilisez {*FTF*} dans vos logs.</td></tr>`;
        return;
    }

    ftfList.sort((a, b) => new Date(b.date) - new Date(a.date)); 
    let html = '';
    ftfList.forEach(ftf => {
        let dStr = ftf.date.split('-').reverse().join('/');
        html += `<tr><td><strong>${dStr}</strong></td><td style="color:#02874d; font-weight:bold;">${ftf.gcCode}</td><td>${ftf.name}</td></tr>`;
    });
    if(tBody) tBody.innerHTML = html;
}

// === GESTION ONGLET TYPES/TAILLES ===
function switchDetailsTab(tab) {
    document.getElementById('containerTypes').style.display = tab === 'types' ? 'block' : 'none';
    document.getElementById('containerSizes').style.display = tab === 'sizes' ? 'block' : 'none';
    const btns = document.getElementById('containerTypes').parentElement.querySelectorAll('.tab-btn');
    btns[0].classList.toggle('active', tab === 'types');
    btns[1].classList.toggle('active', tab === 'sizes');
}

// === GESTION ONGLET FTF / MILESTONES ===
function switchExploitsTab(tab) {
    document.getElementById('tabContent-ftf').style.display = tab === 'ftf' ? 'block' : 'none';
    document.getElementById('tabContent-milestones').style.display = tab === 'milestones' ? 'block' : 'none';
    
    const btns = document.getElementById('tabContent-ftf').parentElement.querySelectorAll('.tab-btn');
    btns[0].classList.toggle('active', tab === 'ftf');
    btns[1].classList.toggle('active', tab === 'milestones');
}

// === MODAL MATRICE D/T (Affiche les types de caches au clic) ===
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

// === GESTION DE LA SUPPRESSION INDIVIDUELLE DES DONNÉES (LES 4 BOUTONS) ===
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
    
    compilerEtAfficher();
}

// === FONCTION DE NETTOYAGE AUTOMATIQUE (Brouillons & Project-GC) ===
function nettoyerTexteGeocaching(texteBrut) {
    let lignes = texteBrut.split('\n').map(l => l.trim());
    let textePropre = "";
    
    for (let i = 0; i < lignes.length; i++) {
        let ligne = lignes[i];
        if (!ligne) continue;

        // --- CAS 1 : TABLEAU PROJECT-GC LAB CACHES ---
        // Format attendu : "1	2023-08-16	Nom de la cache	82"
        let matchPGC = ligne.match(/^\d+[\t\s]+(\d{4}-\d{2}-\d{2})[\t\s]+(.+?)[\t\s]+\d+$/);
        if (matchPGC) {
            let parts = matchPGC[1].split('-');
            // Conversion YYYY-MM-DD en DD/MM/YYYY
            textePropre += `Found it: ${parts[2]}/${parts[1]}/${parts[0]}\n${matchPGC[2].trim()}\n\n`;
            continue;
        }

        // --- CAS 2 : COPIER-COLLER GEOCACHING.COM (Brouillons bruts) ---
        // Recherche des lignes contenant le type de log et la date
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