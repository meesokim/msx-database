// index.js - Application logic for MSX Database search page

// State Management
let database = [];
let filteredData = [];
let currentPage = 1;
let itemsPerPage = 50;
let currentView = 'list'; // 'grid' or 'list'

// DOM Elements
const searchInput = document.getElementById('search-input');
const systemSelect = document.getElementById('filter-system');
const categorySelect = document.getElementById('filter-category');
const publisherSelect = document.getElementById('filter-publisher');
const yearSelect = document.getElementById('filter-year');
const excludeClonesCheck = document.getElementById('filter-exclude-clones');
const supportedOnlyCheck = document.getElementById('filter-supported-only');
const sortBySelect = document.getElementById('sort-by');
const resultsContainer = document.getElementById('results-container');
const resultsCountVal = document.getElementById('results-count-val');
const paginationContainer = document.getElementById('pagination-container');
const viewGridBtn = document.getElementById('view-grid-btn');
const viewListBtn = document.getElementById('view-list-btn');

// Stats DOM Elements
const statTotal = document.getElementById('stat-total');
const statMSX1 = document.getElementById('stat-msx1');
const statMSX2 = document.getElementById('stat-msx2');
const statMSX2p = document.getElementById('stat-msx2p');
const statMSXTR = document.getElementById('stat-msxtr');
const statCartridges = document.getElementById('stat-cartridges');
const statFloppies = document.getElementById('stat-floppies');
const statCassettes = document.getElementById('stat-cassettes');

// Modal DOM Elements
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalAltTitle = document.getElementById('modal-alt-title');
const modalBadgeSystem = document.getElementById('modal-badge-system');
const modalBadgeCategory = document.getElementById('modal-badge-category');
const modalId = document.getElementById('modal-id');
const modalYear = document.getElementById('modal-year');
const modalPublisher = document.getElementById('modal-publisher');
const modalSerial = document.getElementById('modal-serial');
const modalCloneOf = document.getElementById('modal-cloneof');
const modalSupported = document.getElementById('modal-supported');
const modalDbFile = document.getElementById('modal-dbfile');
const modalDbDesc = document.getElementById('modal-dbdesc');
const modalNotes = document.getElementById('modal-notes');
const modalNotesContainer = document.getElementById('modal-notes-container');
const modalPartsContainer = document.getElementById('modal-parts-container');
const copyToast = document.getElementById('copy-toast');

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  if (typeof MSX_RAW_DATA === 'undefined') {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i>
        <h2>데이터 파일을 찾을 수 없습니다</h2>
        <p>msx_data.js 파일이 올바르게 생성되었는지 확인해주세요.</p>
      </div>
    `;
    return;
  }

  // Decompress/Map raw data
  database = MSX_RAW_DATA.map(item => ({
    id: item.i || '',
    title: item.t || '',
    ko_title: item.kt || null,
    year: item.y || 'Unknown',
    publisher: item.p || 'Unknown',
    system: item.s || 'MSX',
    category: item.c || 'Other',
    cloneof: item.cl || null,
    supported: item.sp || 'yes',
    alt_title: item.a || null,
    serial: item.sr || null,
    usage: item.u || null,
    notes: item.n || null,
    parts: item.pt ? item.pt.map(p => ({
      name: p.n || '',
      interface: p.i || '',
      features: p.f || {},
      roms: p.r ? p.r.map(r => ({
        name: r.n || '',
        size: r.sz || '',
        crc: r.c || '',
        sha1: r.sh || '',
        status: r.st || 'good'
      })) : []
    })) : [],
    db_file: item.df || '',
    db_desc: item.dd || '',
    screenshot: item.sf || null,
    youtube: item.yt || null
  }));

  initFilters();
  computeStats();
  applyFiltersAndSearch();
  setupEventListeners();
  initThemeToggle();
});

// Calculate statistics and render dashboard
function computeStats() {
  const total = database.length;
  
  let msx1 = 0, msx2 = 0, msx2p = 0, msxtr = 0, msx = 0;
  let cart = 0, flop = 0, cass = 0, hashDb = 0, other = 0;

  database.forEach(item => {
    // Systems
    if (item.system === 'MSX1') msx1++;
    else if (item.system === 'MSX2') msx2++;
    else if (item.system === 'MSX2+') msx2p++;
    else if (item.system === 'MSX TurboR') msxtr++;
    else msx++;

    // Categories
    if (item.category === 'Cartridge' || item.category === 'Minicart') cart++;
    else if (item.category === 'Floppy') flop++;
    else if (item.category === 'Cassette') cass++;
    else if (item.category === 'Hash Database') hashDb++;
    else other++;
  });

  // Set values in DOM
  statTotal.textContent = total.toLocaleString();
  statMSX1.textContent = msx1.toLocaleString();
  statMSX2.textContent = msx2.toLocaleString();
  statMSX2p.textContent = msx2p.toLocaleString();
  statMSXTR.textContent = msxtr.toLocaleString();
  statCartridges.textContent = cart.toLocaleString();
  statFloppies.textContent = flop.toLocaleString();
  statCassettes.textContent = cass.toLocaleString();

  // Set progress bars
  setProgressBar('pb-msx1', msx1, total);
  setProgressBar('pb-msx2', msx2, total);
  setProgressBar('pb-msx2p', msx2p, total);
  setProgressBar('pb-msxtr', msxtr, total);
  setProgressBar('pb-cart', cart, total);
  setProgressBar('pb-flop', flop, total);
  setProgressBar('pb-cass', cass, total);
}

function setProgressBar(id, value, total) {
  const bar = document.getElementById(id);
  if (bar) {
    const pct = ((value / total) * 100).toFixed(1);
    bar.style.width = `${pct}%`;
  }
}

// Initialize dynamic dropdown filter choices
function initFilters() {
  const publishers = new Set();
  const years = new Set();

  database.forEach(item => {
    if (item.publisher && item.publisher !== 'Unknown' && item.publisher !== '?') {
      publishers.add(item.publisher.trim());
    }
    if (item.year && item.year !== 'Unknown' && item.year !== '????') {
      years.add(item.year.trim());
    }
  });

  // Populate Publisher Select
  const sortedPubs = Array.from(publishers).sort((a, b) => a.localeCompare(b));
  sortedPubs.forEach(pub => {
    const opt = document.createElement('option');
    opt.value = pub;
    opt.textContent = pub;
    publisherSelect.appendChild(opt);
  });

  // Populate Year Select
  const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a)); // Descending order
  sortedYears.forEach(yr => {
    const opt = document.createElement('option');
    opt.value = yr;
    opt.textContent = yr;
    yearSelect.appendChild(opt);
  });
}

// Setup interactive event handlers
function setupEventListeners() {
  // Real-time search-as-you-type with debouncer
  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      applyFiltersAndSearch();
    }, 150);
  });

  // Filters change
  const filterInputs = [
    systemSelect,
    categorySelect,
    publisherSelect,
    yearSelect,
    excludeClonesCheck,
    supportedOnlyCheck,
    sortBySelect
  ];

  filterInputs.forEach(input => {
    input.addEventListener('change', () => {
      currentPage = 1;
      applyFiltersAndSearch();
    });
  });

  // View Switchers
  viewGridBtn.addEventListener('click', () => {
    if (currentView !== 'grid') {
      currentView = 'grid';
      viewGridBtn.classList.add('active');
      viewListBtn.classList.remove('active');
      renderResults();
    }
  });

  viewListBtn.addEventListener('click', () => {
    if (currentView !== 'list') {
      currentView = 'list';
      viewListBtn.classList.add('active');
      viewGridBtn.classList.remove('active');
      renderResults();
    }
  });

  // Modal handlers
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  
  // Keyboard ESC close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeModal();
    }
  });
}

// Update options dynamically and disable those with 0 results
function updateFilterOptions() {
  const query = searchInput.value.toLowerCase().trim();
  const systemFilter = systemSelect.value;
  const categoryFilter = categorySelect.value;
  const publisherFilter = publisherSelect.value;
  const yearFilter = yearSelect.value;
  const excludeClones = excludeClonesCheck.checked;
  const supportedOnly = supportedOnlyCheck.checked;

  // Base matcher (query text, clones, support constraints)
  function matchesBase(item) {
    if (query) {
      const matchText = 
        item.title.toLowerCase().includes(query) ||
        (item.ko_title && item.ko_title.toLowerCase().includes(query)) ||
        item.id.toLowerCase().includes(query) ||
        (item.alt_title && item.alt_title.toLowerCase().includes(query)) ||
        (item.serial && item.serial.toLowerCase().includes(query)) ||
        item.publisher.toLowerCase().includes(query) ||
        item.parts.some(p => 
          p.roms.some(r => 
            r.name.toLowerCase().includes(query) ||
            r.crc.toLowerCase().includes(query) ||
            r.sha1.toLowerCase().includes(query)
          )
        );
      if (!matchText) return false;
    }
    if (excludeClones && item.cloneof) return false;
    if (supportedOnly && item.supported === 'no') return false;
    return true;
  }

  // 1. SYSTEM SELECT OPTIONS (exclude systemFilter from search criteria)
  const subsetForSystem = database.filter(item => {
    if (!matchesBase(item)) return false;
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'Cartridge') {
        if (item.category !== 'Cartridge' && item.category !== 'Minicart') return false;
      } else {
        if (item.category !== categoryFilter) return false;
      }
    }
    if (publisherFilter !== 'all' && item.publisher !== publisherFilter) return false;
    if (yearFilter !== 'all' && item.year !== yearFilter) return false;
    return true;
  });

  const systemCounts = {};
  subsetForSystem.forEach(item => {
    systemCounts[item.system] = (systemCounts[item.system] || 0) + 1;
  });

  Array.from(systemSelect.options).forEach(opt => {
    if (opt.value === 'all') {
      opt.textContent = `전체보기 (All Systems) (${subsetForSystem.length})`;
      opt.disabled = false;
    } else {
      const count = systemCounts[opt.value] || 0;
      const baseLabel = opt.getAttribute('data-base-label') || opt.textContent.replace(/\s\(\d+\)$/, '');
      if (!opt.hasAttribute('data-base-label')) {
        opt.setAttribute('data-base-label', baseLabel);
      }
      opt.textContent = `${baseLabel} (${count})`;
      opt.disabled = (count === 0 && opt.value !== systemFilter);
    }
  });

  // 2. CATEGORY SELECT OPTIONS (exclude categoryFilter from search criteria)
  const subsetForCategory = database.filter(item => {
    if (!matchesBase(item)) return false;
    if (systemFilter !== 'all' && item.system !== systemFilter) return false;
    if (publisherFilter !== 'all' && item.publisher !== publisherFilter) return false;
    if (yearFilter !== 'all' && item.year !== yearFilter) return false;
    return true;
  });

  const categoryCounts = {};
  subsetForCategory.forEach(item => {
    let cat = item.category;
    if (cat === 'Minicart') cat = 'Cartridge';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  Array.from(categorySelect.options).forEach(opt => {
    if (opt.value === 'all') {
      opt.textContent = `전체보기 (All Media) (${subsetForCategory.length})`;
      opt.disabled = false;
    } else {
      const count = categoryCounts[opt.value] || 0;
      const baseLabel = opt.getAttribute('data-base-label') || opt.textContent.replace(/\s\(\d+\)$/, '');
      if (!opt.hasAttribute('data-base-label')) {
        opt.setAttribute('data-base-label', baseLabel);
      }
      opt.textContent = `${baseLabel} (${count})`;
      opt.disabled = (count === 0 && opt.value !== categoryFilter);
    }
  });

  // 3. PUBLISHER SELECT OPTIONS (exclude publisherFilter from search criteria)
  const subsetForPublisher = database.filter(item => {
    if (!matchesBase(item)) return false;
    if (systemFilter !== 'all' && item.system !== systemFilter) return false;
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'Cartridge') {
        if (item.category !== 'Cartridge' && item.category !== 'Minicart') return false;
      } else {
        if (item.category !== categoryFilter) return false;
      }
    }
    if (yearFilter !== 'all' && item.year !== yearFilter) return false;
    return true;
  });

  const publisherCounts = {};
  subsetForPublisher.forEach(item => {
    publisherCounts[item.publisher] = (publisherCounts[item.publisher] || 0) + 1;
  });

  Array.from(publisherSelect.options).forEach(opt => {
    if (opt.value === 'all') {
      opt.textContent = `전체보기 (All Publishers) (${subsetForPublisher.length})`;
      opt.disabled = false;
    } else {
      const count = publisherCounts[opt.value] || 0;
      const baseLabel = opt.getAttribute('data-base-label') || opt.textContent.replace(/\s\(\d+\)$/, '');
      if (!opt.hasAttribute('data-base-label')) {
        opt.setAttribute('data-base-label', baseLabel);
      }
      opt.textContent = `${baseLabel} (${count})`;
      opt.disabled = (count === 0 && opt.value !== publisherFilter);
    }
  });

  // 4. YEAR SELECT OPTIONS (exclude yearFilter from search criteria)
  const subsetForYear = database.filter(item => {
    if (!matchesBase(item)) return false;
    if (systemFilter !== 'all' && item.system !== systemFilter) return false;
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'Cartridge') {
        if (item.category !== 'Cartridge' && item.category !== 'Minicart') return false;
      } else {
        if (item.category !== categoryFilter) return false;
      }
    }
    if (publisherFilter !== 'all' && item.publisher !== publisherFilter) return false;
    return true;
  });

  const yearCounts = {};
  subsetForYear.forEach(item => {
    yearCounts[item.year] = (yearCounts[item.year] || 0) + 1;
  });

  Array.from(yearSelect.options).forEach(opt => {
    if (opt.value === 'all') {
      opt.textContent = `전체보기 (All Years) (${subsetForYear.length})`;
      opt.disabled = false;
    } else {
      const count = yearCounts[opt.value] || 0;
      const baseLabel = opt.getAttribute('data-base-label') || opt.textContent.replace(/\s\(\d+\)$/, '');
      if (!opt.hasAttribute('data-base-label')) {
        opt.setAttribute('data-base-label', baseLabel);
      }
      opt.textContent = `${baseLabel} (${count})`;
      opt.disabled = (count === 0 && opt.value !== yearFilter);
    }
  });
}

// Filter, Search, and Sort
function applyFiltersAndSearch() {
  updateFilterOptions();

  const query = searchInput.value.toLowerCase().trim();
  const systemFilter = systemSelect.value;
  const categoryFilter = categorySelect.value;
  const publisherFilter = publisherSelect.value;
  const yearFilter = yearSelect.value;
  const excludeClones = excludeClonesCheck.checked;
  const supportedOnly = supportedOnlyCheck.checked;
  const sortBy = sortBySelect.value;


  filteredData = database.filter(item => {
    // 1. Text Query
    if (query) {
      const matchText = 
        item.title.toLowerCase().includes(query) ||
        (item.ko_title && item.ko_title.toLowerCase().includes(query)) ||
        item.id.toLowerCase().includes(query) ||
        (item.alt_title && item.alt_title.toLowerCase().includes(query)) ||
        (item.serial && item.serial.toLowerCase().includes(query)) ||
        item.publisher.toLowerCase().includes(query) ||
        item.parts.some(p => 
          p.roms.some(r => 
            r.name.toLowerCase().includes(query) ||
            r.crc.toLowerCase().includes(query) ||
            r.sha1.toLowerCase().includes(query)
          )
        );
      if (!matchText) return false;
    }

    // 2. Select Filters
    if (systemFilter !== 'all' && item.system !== systemFilter) return false;
    
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'Cartridge') {
        if (item.category !== 'Cartridge' && item.category !== 'Minicart') return false;
      } else {
        if (item.category !== categoryFilter) return false;
      }
    }
    
    if (publisherFilter !== 'all' && item.publisher !== publisherFilter) return false;
    if (yearFilter !== 'all' && item.year !== yearFilter) return false;
    
    // 3. Binary checkboxes
    if (excludeClones && item.cloneof) return false;
    if (supportedOnly && item.supported === 'no') return false;

    return true;
  });

  // Sorting
  if (sortBy === 'title-asc') {
    filteredData.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === 'title-desc') {
    filteredData.sort((a, b) => b.title.localeCompare(a.title));
  } else if (sortBy === 'year-desc') {
    filteredData.sort((a, b) => {
      if (a.year === 'Unknown') return 1;
      if (b.year === 'Unknown') return -1;
      return b.year.localeCompare(a.year) || a.title.localeCompare(b.title);
    });
  } else if (sortBy === 'year-asc') {
    filteredData.sort((a, b) => {
      if (a.year === 'Unknown') return 1;
      if (b.year === 'Unknown') return -1;
      return a.year.localeCompare(b.year) || a.title.localeCompare(b.title);
    });
  } else if (sortBy === 'publisher-asc') {
    filteredData.sort((a, b) => a.publisher.localeCompare(b.publisher) || a.title.localeCompare(b.title));
  }

  resultsCountVal.textContent = filteredData.length.toLocaleString();
  renderResults();
}

// Render paginated items
function renderResults() {
  resultsContainer.innerHTML = '';
  
  if (filteredData.length === 0) {
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-folder-open"></i>
        <h2>검색 결과가 없습니다</h2>
        <p>검색어나 필터 조건을 변경해 보세요.</p>
      </div>
    `;
    paginationContainer.innerHTML = '';
    return;
  }

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
  const pageItems = filteredData.slice(startIndex, endIndex);

  if (currentView === 'grid') {
    renderGrid(pageItems);
  } else {
    renderList(pageItems);
  }

  renderPagination(filteredData.length);
}

// Render grid view (cards)
function renderGrid(items) {
  const grid = document.createElement('div');
  grid.className = 'results-grid';

  items.forEach(item => {
    const sysClass = getSystemClass(item.system);
    const hasClone = item.cloneof ? `<span class="clone-badge">Clone</span>` : '';
    const hasScreenshot = item.screenshot ? `<i class="fa-regular fa-image" style="color: var(--accent-cyan); margin-left: 0.35rem;" title="스크린샷 있음"></i>` : '';
    const hasVideo = item.youtube ? `<i class="fa-brands fa-youtube" style="color: #ff0000; margin-left: 0.35rem; font-size: 1.05em; vertical-align: middle;" title="플레이 영상 있음"></i>` : '';
    
    // Choose main title (Korean if translated, else English)
    let mainTitle = item.title;
    let subTitles = [];
    if (item.ko_title) {
      mainTitle = item.ko_title;
      subTitles.push(item.title);
    }
    if (item.alt_title) {
      subTitles.push(item.alt_title);
    }
    
    const subTitleHtml = subTitles.length > 0 
      ? `<span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: -0.15rem; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${subTitles.join(' / ')}">${subTitles.join(' / ')}</span>`
      : '';
    
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <div>
        <div class="card-top">
          <span class="system-badge ${sysClass}">${item.system}</span>
          <span class="category-badge">${item.category}</span>
        </div>
        <h3 class="game-title" title="${mainTitle}">${mainTitle}${hasScreenshot}${hasVideo}</h3>
        ${subTitleHtml}
        <div class="game-publisher" title="${item.publisher}">${item.publisher}</div>
        <div class="game-year-serial">
          <span>${item.year}</span>
          <span>${item.serial || ''}</span>
        </div>
      </div>
      <div class="card-bottom">
        ${hasClone}
        <button class="btn btn-cyan btn-sm btn-detail" data-id="${item.id}" data-type="${item.category === 'Hash Database' ? 'hsi' : 'xml'}">상세 보기</button>
      </div>
    `;
    
    // Details button click event
    card.querySelector('.btn-detail').addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      const type = e.target.getAttribute('data-type');
      showDetails(id, type);
    });

    grid.appendChild(card);
  });

  resultsContainer.appendChild(grid);
}

// Render list view (table)
function renderList(items) {
  const container = document.createElement('div');
  container.className = 'results-table-container';

  let tableHtml = `
    <table class="results-table">
      <thead>
        <tr>
          <th>시스템</th>
          <th>분류</th>
          <th>게임 제목</th>
          <th>제작사/출판사</th>
          <th>연도</th>
          <th>시리얼 번호</th>
        </tr>
      </thead>
      <tbody>
  `;

  items.forEach(item => {
    const sysClass = getSystemClass(item.system);
    const cloneLabel = item.cloneof ? ` <span class="clone-badge" style="font-size:0.6rem;">Clone</span>` : '';
    const hasScreenshot = item.screenshot ? `<i class="fa-regular fa-image" style="color: var(--accent-cyan); margin-left: 0.35rem;" title="스크린샷 있음"></i>` : '';
    const hasVideo = item.youtube ? `<i class="fa-brands fa-youtube" style="color: #ff0000; margin-left: 0.35rem; font-size: 1.05em; vertical-align: middle;" title="플레이 영상 있음"></i>` : '';
    const dbType = item.category === 'Hash Database' ? 'hsi' : 'xml';
    
    // Choose main title (Korean if translated, else English)
    let mainTitle = item.title;
    let subTitles = [];
    if (item.ko_title) {
      mainTitle = item.ko_title;
      subTitles.push(item.title);
    }
    if (item.alt_title) {
      subTitles.push(item.alt_title);
    }
    
    tableHtml += `
      <tr class="table-row-clickable" data-id="${item.id}" data-type="${dbType}">
        <td><span class="system-badge ${sysClass}">${item.system}</span></td>
        <td><span class="category-badge">${item.category}</span></td>
        <td>
          <div class="table-title" title="${mainTitle}">${mainTitle}${cloneLabel}${hasScreenshot}${hasVideo}</div>
          ${subTitles.length > 0 ? `<div style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">${subTitles.join(' / ')}</div>` : ''}
        </td>
        <td>${item.publisher}</td>
        <td class="table-mono">${item.year}</td>
        <td class="table-mono">${item.serial || '-'}</td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  container.innerHTML = tableHtml;

  // Add click handlers for clickable rows in table
  container.querySelectorAll('.table-row-clickable').forEach(row => {
    row.addEventListener('click', (e) => {
      const id = row.getAttribute('data-id');
      const type = row.getAttribute('data-type');
      showDetails(id, type);
    });
  });

  resultsContainer.appendChild(container);
}

// System tag custom classes helper
function getSystemClass(system) {
  switch (system) {
    case 'MSX1': return 'sys-msx1';
    case 'MSX2': return 'sys-msx2';
    case 'MSX2+': return 'sys-msx2p';
    case 'MSX TurboR': return 'sys-msxturbor';
    default: return 'sys-msx';
  }
}

// Generate pagination controls
function renderPagination(totalItems) {
  paginationContainer.innerHTML = '';
  
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return;

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  // Prev Button
  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    currentPage--;
    renderResults();
    window.scrollTo({ top: searchInput.offsetTop - 100, behavior: 'smooth' });
  };
  paginationContainer.appendChild(prevBtn);

  // First page & dots
  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.className = 'page-btn';
    firstBtn.textContent = '1';
    firstBtn.onclick = () => {
      currentPage = 1;
      renderResults();
      window.scrollTo({ top: searchInput.offsetTop - 100, behavior: 'smooth' });
    };
    paginationContainer.appendChild(firstBtn);

    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.className = 'page-info';
      dots.textContent = '...';
      paginationContainer.appendChild(dots);
    }
  }

  // Page Numbers
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('button');
    btn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
    btn.textContent = i;
    btn.onclick = () => {
      currentPage = i;
      renderResults();
      window.scrollTo({ top: searchInput.offsetTop - 100, behavior: 'smooth' });
    };
    paginationContainer.appendChild(btn);
  }

  // Last page & dots
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.className = 'page-info';
      dots.textContent = '...';
      paginationContainer.appendChild(dots);
    }

    const lastBtn = document.createElement('button');
    lastBtn.className = 'page-btn';
    lastBtn.textContent = totalPages;
    lastBtn.onclick = () => {
      currentPage = totalPages;
      renderResults();
      window.scrollTo({ top: searchInput.offsetTop - 100, behavior: 'smooth' });
    };
    paginationContainer.appendChild(lastBtn);
  }

  // Next Button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => {
    currentPage++;
    renderResults();
    window.scrollTo({ top: searchInput.offsetTop - 100, behavior: 'smooth' });
  };
  paginationContainer.appendChild(nextBtn);
}

// Display game details in the modal
function showDetails(id, type) {
  const item = database.find(x => x.id === id && (type === 'hsi' ? x.category === 'Hash Database' : x.category !== 'Hash Database'));
  
  if (!item) return;

  // Screenshot dynamic loading
  const screenshotImg = document.getElementById('modal-screenshot');
  const screenshotContainer = document.getElementById('modal-screenshot-container');

  if (item.screenshot) {
    function sanitizeFilename(filename) {
      return filename.replace(/[\\/*?:"<>|]/g, "");
    }

    const safeTitle = sanitizeFilename(item.title);
    const localUrl = `screenshots/${encodeURIComponent(safeTitle)}.png`;
    
    // Construct the online screenshot URL safely using the mapped path from PlanetEmu
    const encodedPath = encodeURIComponent(item.screenshot).replace(/%2F/g, '/').replace(/\(/g, "%28").replace(/\)/g, "%29");
    const onlineUrl = `https://www.planetemu.net/screenshots/${encodedPath}`;

    // Reset image properties
    screenshotImg.onerror = null;
    screenshotContainer.style.display = 'flex';
    screenshotImg.src = localUrl;

    screenshotImg.onerror = () => {
      if (screenshotImg.src.indexOf("screenshots/") !== -1) {
        screenshotImg.src = onlineUrl;
      } else {
        screenshotImg.onerror = null;
        screenshotContainer.style.display = 'none';
      }
    };
  } else {
    screenshotContainer.style.display = 'none';
  }

  // YouTube player loading
  const youtubeContainer = document.getElementById('modal-youtube-container');
  const youtubeIframe = document.getElementById('modal-youtube-iframe');
  const ytSearchLinkContainer = document.getElementById('modal-youtube-link-container');

  if (item.youtube) {
    youtubeContainer.style.display = 'block';
    youtubeIframe.src = 'https://www.youtube.com/embed/' + item.youtube;
    
    const videoUrl = `https://www.youtube.com/watch?v=${item.youtube}`;
    ytSearchLinkContainer.innerHTML = `<a href="${videoUrl}" target="_blank" style="color: #ff00ff; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;"><i class="fa-brands fa-youtube" style="font-size: 1.1rem; color: #ff0000;"></i> 유튜브에서 재생 (Watch on YouTube)</a>`;
  } else {
    youtubeContainer.style.display = 'none';
    youtubeIframe.src = '';
    
    let queryTerms = `MSX ${item.title}`;
    if (item.ko_title) {
      queryTerms += ` ${item.ko_title}`;
    }
    queryTerms += ' gameplay';
    const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryTerms)}`;
    ytSearchLinkContainer.innerHTML = `<a href="${ytSearchUrl}" target="_blank" style="color: var(--text-muted); text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;"><i class="fa-brands fa-youtube" style="font-size: 1.1rem; color: var(--text-muted);"></i> 유튜브에서 검색 (Search gameplay)</a>`;
  }

  if (item.ko_title) {
    modalTitle.textContent = item.ko_title;
    let subTitleText = item.title;
    if (item.alt_title) {
      subTitleText += ` (${item.alt_title})`;
    }
    modalAltTitle.textContent = subTitleText;
  } else {
    modalTitle.textContent = item.title;
    modalAltTitle.textContent = item.alt_title || '';
  }
  
  // Set badges
  modalBadgeSystem.className = `system-badge ${getSystemClass(item.system)}`;
  modalBadgeSystem.textContent = item.system;
  modalBadgeCategory.textContent = item.category;
  
  // Fill details table
  modalId.textContent = item.id;
  modalYear.textContent = item.year;
  modalPublisher.textContent = item.publisher;
  modalSerial.textContent = item.serial || '-';
  modalCloneOf.textContent = item.cloneof ? `${item.cloneof}` : '-';
  modalSupported.textContent = item.supported === 'yes' ? '지원함 (Yes)' : '지원안함 (No)';
  modalDbFile.textContent = item.db_file;
  modalDbDesc.textContent = item.db_desc;

  // Usage / Notes
  let notesHtml = '';
  if (item.usage) {
    notesHtml += `<strong>실행법 (Usage):</strong> ${item.usage}<br>`;
  }
  if (item.notes) {
    notesHtml += `<strong>참고사항 (Notes):</strong> ${item.notes}`;
  }
  
  if (notesHtml) {
    modalNotes.innerHTML = notesHtml;
    modalNotesContainer.style.display = 'block';
  } else {
    modalNotesContainer.style.display = 'none';
  }

  // Render Parts & ROMs list
  modalPartsContainer.innerHTML = '';
  if (item.parts && item.parts.length > 0) {
    item.parts.forEach(part => {
      const partEl = document.createElement('div');
      partEl.className = 'part-card';
      
      // Feature list
      let featuresHtml = '';
      if (part.features && Object.keys(part.features).length > 0) {
        featuresHtml = '<div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">';
        for (const [key, value] of Object.entries(part.features)) {
          featuresHtml += `<span style="margin-right: 0.75rem;"><strong>${key}:</strong> ${value}</span>`;
        }
        featuresHtml += '</div>';
      }

      // ROMs table
      let romRows = '';
      if (part.roms && part.roms.length > 0) {
        part.roms.forEach(rom => {
          const statusClass = rom.status === 'good' ? 'rom-status-good' : 'rom-status-baddump';
          const sizeFormatted = formatBytes(rom.size) || '-';
          const crcBtn = rom.crc ? `<button class="copy-btn" onclick="copyText('${rom.crc}', 'CRC32 코드가 복사되었습니다.')" title="CRC32 복사"><i class="fa-regular fa-copy"></i></button>` : '';
          const sha1Btn = rom.sha1 ? `<button class="copy-btn" onclick="copyText('${rom.sha1}', 'SHA1 코드가 복사되었습니다.')" title="SHA1 복사"><i class="fa-regular fa-copy"></i></button>` : '';
          
          romRows += `
            <tr>
              <td class="rom-name" title="${rom.name}">${rom.name || 'N/A'}</td>
              <td>${sizeFormatted}</td>
              <td>
                <span>${rom.crc || '-'}</span> ${crcBtn}
              </td>
              <td>
                <span style="font-size:0.7rem;">${rom.sha1 ? rom.sha1.substring(0,8) + '...' : '-'}</span> ${sha1Btn}
              </td>
              <td><span class="${statusClass}">${rom.status.toUpperCase()}</span></td>
            </tr>
          `;
        });
      } else {
        romRows = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">롬 파일 정보 없음</td></tr>`;
      }

      partEl.innerHTML = `
        <div class="part-header">
          <span>Part: <span class="part-interface">${part.name}</span></span>
          <span>Interface: <span class="part-interface">${part.interface || 'Generic'}</span></span>
        </div>
        <table class="roms-table">
          <thead>
            <tr>
              <th>파일명 (File Name)</th>
              <th>용량 (Size)</th>
              <th>CRC32</th>
              <th>SHA1 (Short)</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            ${romRows}
          </tbody>
        </table>
        ${featuresHtml}
      `;
      modalPartsContainer.appendChild(partEl);
    });
  } else {
    modalPartsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem;">부속 파트 정보가 없습니다.</div>';
  }

  // Open Modal
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  const youtubeIframe = document.getElementById('modal-youtube-iframe');
  if (youtubeIframe) {
    youtubeIframe.src = '';
  }
}

// File Size Formatting Utility (supports hexadecimal sizes too)
function formatBytes(sizeStr) {
  if (!sizeStr) return '';
  
  let bytes = 0;
  if (sizeStr.startsWith('0x') || sizeStr.startsWith('0X')) {
    bytes = parseInt(sizeStr, 16);
  } else {
    bytes = parseInt(sizeStr, 10);
  }
  
  if (isNaN(bytes)) return sizeStr;
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Copy to Clipboard Action
window.copyText = function(text, successMsg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg);
  }).catch(err => {
    console.error('Clipboard copy failed: ', err);
  });
};

function showToast(msg) {
  copyToast.textContent = msg;
  copyToast.classList.add('active');
  setTimeout(() => {
    copyToast.classList.remove('active');
  }, 2000);
}

function initThemeToggle() {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');

  // Check saved theme, default to 'light'
  const currentTheme = localStorage.getItem('theme') || 'light';
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
    if (themeIconSun) themeIconSun.style.display = 'block';
    if (themeIconMoon) themeIconMoon.style.display = 'none';
  } else {
    document.body.classList.remove('light-theme');
    if (themeIconSun) themeIconSun.style.display = 'none';
    if (themeIconMoon) themeIconMoon.style.display = 'block';
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      
      if (isLight) {
        if (themeIconSun) themeIconSun.style.display = 'block';
        if (themeIconMoon) themeIconMoon.style.display = 'none';
      } else {
        if (themeIconSun) themeIconSun.style.display = 'none';
        if (themeIconMoon) themeIconMoon.style.display = 'block';
      }
    });
  }
}
