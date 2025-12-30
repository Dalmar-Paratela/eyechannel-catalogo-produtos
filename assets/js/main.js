// Controle do dropdown (nível 1)
    document.querySelectorAll('.logos-menu li img').forEach(logo => {
        logo.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = logo.nextElementSibling;
            const isActive = dropdown.classList.contains('active');

            document.querySelectorAll('.dropdown, .sub-dropdown').forEach(d => d.classList.remove('active'));
            document.querySelectorAll('.dropdown li a').forEach(a => a.classList.remove('active-sub'));

            if (!isActive) {
                dropdown.classList.add('active');
            }
        });
    });

    // Controle do sub-dropdown (nível 2) - COM AJUSTE INTELIGENTE
    document.querySelectorAll('.dropdown > li > a').forEach(item => {
        item.addEventListener('click', (e) => {
            const sub = item.nextElementSibling;
            if (sub && sub.classList.contains('sub-dropdown')) {
                e.preventDefault();
                e.stopPropagation();
                const isActive = sub.classList.contains('active');

                // Fecha todos
                document.querySelectorAll('.sub-dropdown').forEach(d => {
                    d.classList.remove('active', 'flip-left');
                });
                document.querySelectorAll('.dropdown li a').forEach(a => a.classList.remove('active-sub'));

                if (!isActive) {
                    sub.classList.add('active');
                    item.classList.add('active-sub');

                    // Ajuste inteligente: abre à esquerda se necessário
                    setTimeout(() => {
                        const rect = sub.getBoundingClientRect();
                        const viewportWidth = window.innerWidth;

                        if (rect.right > viewportWidth - 10) {
                            sub.classList.add('flip-left');
                        }
                    }, 10);
                }
            }
        });
    });

    // Fecha ao clicar fora
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown, .sub-dropdown').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('.dropdown li a').forEach(a => a.classList.remove('active-sub'));
    });

    // Navegação para product.html
    document.querySelectorAll('.sub-dropdown li a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const device = link.textContent.trim();
            const companyLi = link.closest('.logos-menu > li');
            if (!companyLi) return;

            const companyImg = companyLi.querySelector('img');
            if (!companyImg) return;

            const src = companyImg.getAttribute('src') || '';
            const company = src.split('/').pop().split('.')[0];

            window.location.href = `product.html?device=${encodeURIComponent(device)}&company=${encodeURIComponent(company)}`;
        });
    });
    

// ====== Catálogo: Busca (autocomplete + Enter abre o produto) ======
(function () {
    const input = document.getElementById('catalogSearchInput');
    const btn = document.getElementById('catalogSearchBtn');
    const sug = document.getElementById('catalogSearchSuggestions');
    const results = document.getElementById('catalogSearchResults');

    if (!input || !btn || !sug || !results) return;

    const MIN_CHARS = 2;
    const MAX_SUGGESTIONS = 12;

    // Normaliza: sem acento, sem diferença de maiúscula/minúscula
    function norm(str) {
        return (str || '')
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')     // remove diacríticos
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')        // troca pontuação por espaço
            .replace(/\s+/g, ' ')
            .trim();
    }

    function fileBaseName(path) {
        const last = (path || '').split('/').pop() || '';
        return last.replace(/\.[a-z0-9]+$/i, '');
    }

    // Indexa o catálogo lendo o próprio DOM (empresa > tipo > aparelho)
    function buildIndexFromDom() {
        const companyLis = Array.from(document.querySelectorAll('.logos-menu > li'));
        const deviceEntries = [];
        const companyEntries = [];
        const typeEntries = [];
        const companyToDevices = new Map();
        const typeToDevices = new Map();

        for (const li of companyLis) {
            const img = li.querySelector(':scope > img');
            const dropdown = li.querySelector(':scope > ul.dropdown');
            if (!img || !dropdown) continue;

            const companySlug = fileBaseName(img.getAttribute('src') || '');
            const companyName = (img.getAttribute('alt') || companySlug).replace(/\s+logo$/i, '').trim();

            // Empresa (entrada "navegável")
            companyEntries.push({
                kind: 'company',
                label: companyName,
                companyName,
                companySlug,
                n: norm(companyName)
            });

            const typeLis = Array.from(dropdown.querySelectorAll(':scope > li'));
            for (const typeLi of typeLis) {
                const typeA = typeLi.querySelector(':scope > a');
                const sub = typeLi.querySelector(':scope > ul.sub-dropdown');
                const typeName = (typeA ? typeA.textContent : '').trim();
                if (!typeName || !sub) continue;

                // Tipo (entrada "navegável")
                typeEntries.push({
                    kind: 'type',
                    label: typeName,
                    typeName,
                    n: norm(typeName)
                });

                const deviceAs = Array.from(sub.querySelectorAll('li > a'));
                for (const a of deviceAs) {
                    const deviceName = (a.textContent || '').trim();
                    if (!deviceName) continue;

                    const entry = {
                        kind: 'device',
                        label: deviceName,
                        deviceName,
                        companyName,
                        companySlug,
                        typeName,
                        n: norm([deviceName, companyName, typeName].join(' '))
                    };

                    deviceEntries.push(entry);

                    if (!companyToDevices.has(companySlug)) companyToDevices.set(companySlug, []);
                    companyToDevices.get(companySlug).push(entry);

                    const tKey = norm(typeName);
                    if (!typeToDevices.has(tKey)) typeToDevices.set(tKey, []);
                    typeToDevices.get(tKey).push(entry);
                }
            }
        }

        // Remove duplicatas simples de types (pelo norm)
        const seenTypes = new Set();
        const uniqueTypeEntries = [];
        for (const t of typeEntries) {
            if (seenTypes.has(t.n)) continue;
            seenTypes.add(t.n);
            uniqueTypeEntries.push(t);
        }

        return {
            deviceEntries,
            companyEntries,
            typeEntries: uniqueTypeEntries,
            companyToDevices,
            typeToDevices
        };
    }

    const IDX = buildIndexFromDom();
    const ALL = [...IDX.deviceEntries, ...IDX.companyEntries, ...IDX.typeEntries];

    // (Opcional) puxa products.json só para enriquecer com descrição curta, se existir
    const productTextByDevice = new Map();
    fetch('assets/data/products.json')
        .then(r => r.ok ? r.json() : null)
        .then(json => {
            if (!json) return;
            Object.keys(json).forEach(k => {
                const text = (json[k] && json[k].text) ? String(json[k].text) : '';
                if (text) productTextByDevice.set(norm(k), text);
            });
        })
        .catch(() => { /* silencioso: não impede a busca */ });

    function tokensMatch(haystackNorm, qNorm) {
        const tokens = qNorm.split(' ').filter(Boolean);
        if (tokens.length === 0) return false;
        return tokens.every(t => haystackNorm.includes(t));
    }

    function scoreEntry(entry, qNorm) {
        let score = 0;
        if (entry.kind === 'device') score += 30;
        if (entry.kind === 'company') score += 20;
        if (entry.kind === 'type') score += 10;

        const labelN = norm(entry.label);
        if (labelN.startsWith(qNorm)) score += 12;
        if (entry.n.startsWith(qNorm)) score += 8;
        if (entry.n.includes(qNorm)) score += 4;
        return score;
    }

    function findMatches(qRaw) {
        const qNorm = norm(qRaw);
        if (qNorm.length < MIN_CHARS) return { qNorm, matches: [] };

        const matches = ALL
            .filter(e => tokensMatch(e.n || e.n === '' ? e.n : norm(e.label), qNorm) || tokensMatch(norm(e.label), qNorm))
            .map(e => ({ e, s: scoreEntry(e, qNorm) }))
            .sort((a, b) => b.s - a.s || a.e.label.localeCompare(b.e.label, 'pt-BR'))
            .slice(0, MAX_SUGGESTIONS)
            .map(x => x.e);

        return { qNorm, matches };
    }

    function hideSuggestions() {
        sug.classList.remove('show');
        sug.innerHTML = '';
        activeIndex = -1;
    }

    function showSuggestions(items) {
        sug.innerHTML = '';
        activeIndex = -1;

        if (!items.length) {
            hideSuggestions();
            return;
        }

        for (const item of items) {
            const li = document.createElement('li');
            const b = document.createElement('button');
            b.type = 'button';
            b.setAttribute('role', 'option');

            const title = document.createElement('div');
            title.className = 's-title';
            title.textContent = item.label;

            const meta = document.createElement('div');
            meta.className = 's-meta';

            if (item.kind === 'device') {
                meta.textContent = `${item.companyName} • ${item.typeName}`;
            } else if (item.kind === 'company') {
                meta.textContent = 'Empresa';
            } else {
                meta.textContent = 'Tipo de aparelho';
            }

            const kind = document.createElement('span');
            kind.className = 's-kind';
            kind.textContent = item.kind === 'device' ? 'Produto' : (item.kind === 'company' ? 'Empresa' : 'Tipo');

            const right = document.createElement('div');
            right.appendChild(kind);

            b.appendChild(title);
            b.appendChild(right);
            b.appendChild(meta);

            // Layout: 2 colunas (title/kind) + meta embaixo
            b.style.gridTemplateColumns = '1fr auto';
            b.style.gridAutoRows = 'auto';
            title.style.gridColumn = '1 / 2';
            right.style.gridColumn = '2 / 3';
            meta.style.gridColumn = '1 / 3';

            b.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                selectItem(item);
            });

            li.appendChild(b);
            sug.appendChild(li);
        }

        sug.classList.add('show');
    }

    function openDevice(entry) {
        const url = `product.html?device=${encodeURIComponent(entry.deviceName)}&company=${encodeURIComponent(entry.companySlug)}`;
        window.location.href = url;
    }

    function scrollToCompany(companySlug) {
        const companyLi = Array.from(document.querySelectorAll('.logos-menu > li')).find(li => {
            const img = li.querySelector(':scope > img');
            if (!img) return false;
            return fileBaseName(img.getAttribute('src') || '') === companySlug;
        });
        if (!companyLi) return;

        companyLi.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // simula o clique para abrir o dropdown daquela empresa
        const img = companyLi.querySelector(':scope > img');
        if (img) img.click();
    }

    function showResults(title, devices) {
        results.hidden = false;

        const h = document.createElement('h3');
        h.textContent = title;

        const grid = document.createElement('div');
        grid.className = 'results-grid';

        for (const d of devices) {
            const a = document.createElement('a');
            a.href = `product.html?device=${encodeURIComponent(d.deviceName)}&company=${encodeURIComponent(d.companySlug)}`;

            const t = document.createElement('div');
            t.textContent = d.deviceName;

            const m = document.createElement('div');
            m.className = 'r-meta';
            m.textContent = `${d.companyName} • ${d.typeName}`;

            a.appendChild(t);
            a.appendChild(m);
            grid.appendChild(a);
        }

        results.innerHTML = '';
        results.appendChild(h);
        results.appendChild(grid);
    }

    function hideResults() {
        results.hidden = true;
        results.innerHTML = '';
    }

    function selectItem(item) {
        hideSuggestions();

        if (item.kind === 'device') {
            hideResults();
            openDevice(item);
            return;
        }

        if (item.kind === 'company') {
            const devices = (IDX.companyToDevices.get(item.companySlug) || []).slice()
                .sort((a, b) => a.deviceName.localeCompare(b.deviceName, 'pt-BR'));
            showResults(`Produtos — ${item.companyName}`, devices);
            scrollToCompany(item.companySlug);
            return;
        }

        if (item.kind === 'type') {
            const devices = (IDX.typeToDevices.get(item.n) || []).slice()
                .sort((a, b) => a.companyName.localeCompare(b.companyName, 'pt-BR') || a.deviceName.localeCompare(b.deviceName, 'pt-BR'));
            showResults(`Resultados — ${item.typeName}`, devices);
            return;
        }
    }

    // -------- Interação / teclado --------
    let activeIndex = -1;

    function setActive(index) {
        const buttons = Array.from(sug.querySelectorAll('button'));
        buttons.forEach(b => b.classList.remove('active'));
        if (index < 0 || index >= buttons.length) {
            activeIndex = -1;
            return;
        }
        activeIndex = index;
        buttons[index].classList.add('active');
        buttons[index].scrollIntoView({ block: 'nearest' });
    }

    function pickActiveOrRunQuery() {
        const buttons = Array.from(sug.querySelectorAll('button'));
        const items = Array.from(sug.querySelectorAll('li')).map((li, idx) => {
            const btn = li.querySelector('button');
            // A ordem do DOM segue a ordem do "matches" gerado; reconstruiremos via lastMatches
            return btn ? idx : idx;
        });

        if (activeIndex >= 0 && lastMatches[activeIndex]) {
            selectItem(lastMatches[activeIndex]);
            return;
        }

        // Sem seleção: Enter deve abrir produto se houver 1 match de produto.
        const q = input.value || '';
        const { matches } = findMatches(q);
        const deviceMatches = matches.filter(m => m.kind === 'device');

        if (deviceMatches.length === 1) {
            hideResults();
            openDevice(deviceMatches[0]);
            return;
        }

        // Se houver mais de 1 produto, mostra lista de resultados.
        if (deviceMatches.length > 1) {
            showResults(`Resultados — "${q.trim()}"`, deviceMatches);
            hideSuggestions();
            return;
        }

        // Se não houver produto, tenta empresa / tipo (primeiro match)
        if (matches.length) {
            selectItem(matches[0]);
        }
    }

    let lastMatches = [];

    function onInputChanged() {
        hideResults();

        const q = input.value || '';
        const { matches } = findMatches(q);
        lastMatches = matches;
        showSuggestions(matches);
    }

    input.addEventListener('input', onInputChanged);

    input.addEventListener('keydown', (e) => {
        if (!sug.classList.contains('show')) {
            if (e.key === 'Enter') {
                e.preventDefault();
                pickActiveOrRunQuery();
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(activeIndex + 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(activeIndex - 1);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hideSuggestions();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            pickActiveOrRunQuery();
        }
    });

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pickActiveOrRunQuery();
    });

    // Evita que o clique dentro da busca feche dropdowns/sugestões
    document.getElementById('catalogSearch').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Fecha sugestões ao clicar fora (mantém o comportamento atual do site)
    document.addEventListener('click', () => {
        hideSuggestions();
    });

})();
