// ==========================================
// 💌 디지털 롤링페이퍼 동작 로직 (app.js)
// ==========================================

let supabaseClient = null;
let allNotes = []; // 현재 로드된 메모 목록

// 1. DOM 요소 참조
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const writeModal = document.getElementById('writeModal');
const memoForm = document.getElementById('memoForm');
const authorInput = document.getElementById('authorInput');
const contentInput = document.getElementById('contentInput');
const charCount = document.getElementById('charCount');
const submitBtn = document.getElementById('submitBtn');
const submitText = document.getElementById('submitText');
const submitSpinner = document.getElementById('submitSpinner');
const notesGrid = document.getElementById('notesGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const configAlert = document.getElementById('configAlert');
const toast = document.getElementById('toast');
const colorOptions = document.querySelectorAll('.color-option');

// 2. 초기화 함수
function init() {
    setupColorPicker();
    setupEventListeners();

    // Supabase 설정 확인 및 클라이언트 생성
    const isConfigValid = checkConfig();
    if (isConfigValid) {
        initSupabase();
        fetchNotes();
    } else {
        // 설정이 아직 안 되어 있으면 안내 배너 표시 및 예시 데이터 로드
        configAlert.style.display = 'flex';
        loadingState.style.display = 'none';
        loadDemoNotes();
    }
}

function getConfig() {
    if (typeof window !== 'undefined' && window.SUPABASE_CONFIG) {
        return window.SUPABASE_CONFIG;
    }
    if (typeof SUPABASE_CONFIG !== 'undefined') {
        return SUPABASE_CONFIG;
    }
    return null;
}

// 3. Supabase 설정 확인
function checkConfig() {
    const config = getConfig();
    if (!config) return false;
    const { url, anonKey } = config;
    if (!url || !anonKey) return false;
    if (url.includes('여기에_') || anonKey.includes('여기에_')) return false;
    return true;
}

// 4. Supabase 클라이언트 초기화
function initSupabase() {
    try {
        const config = getConfig();
        if (!config) return;
        const { createClient } = window.supabase;
        supabaseClient = createClient(
            config.url,
            config.anonKey
        );
    } catch (err) {
        console.error('Supabase 초기화 실패:', err);
        showToast('⚠️ Supabase 연결에 실패했습니다. 설정값을 확인해주세요.');
    }
}

// 5. 메모 목록 가져오기 (Supabase DB 조회)
async function fetchNotes() {
    if (!supabaseClient) return;

    loadingState.style.display = 'block';
    emptyState.style.display = 'none';
    notesGrid.innerHTML = '';

    try {
        // messages 테이블에서 최신순(created_at 내림차순)으로 조회
        const { data, error } = await supabaseClient
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        allNotes = data || [];
        renderNotes(allNotes);
    } catch (err) {
        console.error('메모 로드 오류:', err);
        showToast('⚠️ 메모를 불러오는 중 오류가 발생했습니다.');
        loadingState.style.display = 'none';
    }
}

// 6. 메모 화면 렌더링
function renderNotes(notes) {
    loadingState.style.display = 'none';
    notesGrid.innerHTML = '';
    totalCount.textContent = notes.length;

    if (!notes || notes.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    notes.forEach((note, index) => {
        const card = createNoteElement(note, index);
        notesGrid.appendChild(card);
    });
}

// 7. 개별 포스트잇 엘리먼트 생성
function createNoteElement(note, index) {
    const card = document.createElement('div');
    const color = note.color || 'yellow';
    card.className = `note-card note-${color}`;

    // 자연스러운 포스트잇 느낌을 위한 미세한 무작위 회전 (-2도 ~ +2도)
    const rotations = [-1.5, 1.2, -0.8, 1.8, -1.2, 0.6];
    const rot = rotations[index % rotations.length];
    card.style.transform = `rotate(${rot}deg)`;

    const formattedDate = formatDate(note.created_at);
    const safeAuthor = escapeHtml(note.author || '익명');
    const safeContent = escapeHtml(note.content || '');

    card.innerHTML = `
        <div class="note-body">${safeContent}</div>
        <div class="note-footer">
            <span class="note-author">${safeAuthor}</span>
            <span class="note-date">${formattedDate}</span>
        </div>
    `;

    return card;
}

// 8. 새 메모 저장하기 (Supabase INSERT)
async function submitMemo(e) {
    e.preventDefault();

    const author = authorInput.value.trim();
    const content = contentInput.value.trim();
    const selectedColorInput = document.querySelector('input[name="memoColor"]:checked');
    const color = selectedColorInput ? selectedColorInput.value : 'yellow';

    if (!author || !content) {
        alert('작성자와 메시지를 모두 입력해주세요.');
        return;
    }

    // 설정이 안 된 상태라면 안내
    if (!checkConfig() || !supabaseClient) {
        alert('Supabase 연동 정보가 아직 설정되지 않았습니다!\nconfig.js 파일에 URL과 anonKey를 먼저 입력해주세요.');
        return;
    }

    // 버튼 로딩 상태 전환
    setSubmitting(true);

    try {
        const { data, error } = await supabaseClient
            .from('messages')
            .insert([
                {
                    author: author,
                    content: content,
                    color: color
                }
            ])
            .select();

        if (error) throw error;

        // 성공 처리
        closeModal();
        memoForm.reset();
        charCount.textContent = '0';
        resetColorPicker();
        showToast('🎉 메모가 성공적으로 등록되었습니다!');

        // 목록 새로고침
        fetchNotes();
    } catch (err) {
        console.error('메모 등록 실패:', err);
        alert('메모 저장에 실패했습니다: ' + (err.message || '네트워크 오류'));
    } finally {
        setSubmitting(false);
    }
}

// 9. 날짜 포맷 함수 (친근한 한국어 표현)
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return '방금 전';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}분 전`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}시간 전`;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

// 10. XSS 방지 HTML 이스케이프
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// 11. 모달 제어
function openModal() {
    writeModal.classList.add('active');
    setTimeout(() => authorInput.focus(), 150);
}

function closeModal() {
    writeModal.classList.remove('active');
}

// 12. 색상 선택기 UI 이벤트
function setupColorPicker() {
    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            colorOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
        });
    });
}

function resetColorPicker() {
    colorOptions.forEach(o => o.classList.remove('active'));
    const defaultOption = document.querySelector('.color-option.color-yellow');
    if (defaultOption) {
        defaultOption.classList.add('active');
        defaultOption.querySelector('input').checked = true;
    }
}

// 13. 버튼 로딩 상태 제어
function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    if (isSubmitting) {
        submitText.style.display = 'none';
        submitSpinner.style.display = 'inline-block';
    } else {
        submitText.style.display = 'inline';
        submitSpinner.style.display = 'none';
    }
}

// 14. 토스트 알림 표시
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// 15. 검색 필터링
function handleSearch(e) {
    const keyword = e.target.value.toLowerCase().trim();
    if (!keyword) {
        renderNotes(allNotes);
        return;
    }

    const filtered = allNotes.filter(note => {
        const author = (note.author || '').toLowerCase();
        const content = (note.content || '').toLowerCase();
        return author.includes(keyword) || content.includes(keyword);
    });

    renderNotes(filtered);
}

// 16. 이벤트 리스너 등록
function setupEventListeners() {
    openModalBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // 모달 배경 클릭 시 닫기
    writeModal.addEventListener('click', (e) => {
        if (e.target === writeModal) closeModal();
    });

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && writeModal.classList.contains('active')) {
            closeModal();
        }
    });

    // 글자 수 실시간 표시
    contentInput.addEventListener('input', () => {
        charCount.textContent = contentInput.value.length;
    });

    // 폼 제출
    memoForm.addEventListener('submit', submitMemo);

    // 새로고침 버튼
    refreshBtn.addEventListener('click', () => {
        if (checkConfig()) {
            fetchNotes();
            showToast('🔄 최신 메모를 불러왔습니다!');
        } else {
            showToast('💡 Supabase 연동 설정을 먼저 완료해주세요.');
        }
    });

    // 실시간 검색
    searchInput.addEventListener('input', handleSearch);
}

// 17. 설정 전 예시(데모) 데이터
function loadDemoNotes() {
    allNotes = [
        {
            id: 1,
            author: '시니어 개발자 멘토',
            content: '디지털 롤링페이퍼 프로젝트 시작을 축하합니다! 🎉\nSupabase와 Vercel을 연결하면 실시간 공개 웹서비스가 완성됩니다. 가이드 순서대로 하나씩 따라해보세요!',
            color: 'yellow',
            created_at: new Date().toISOString()
        },
        {
            id: 2,
            author: '열정 동기',
            content: '졸업과 임관까지 모두 파이팅입니다! 다들 원하는 목표 꼭 이루길 진심으로 응원할게 ✨',
            color: 'pink',
            created_at: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
            id: 3,
            author: '비밀 친구 🐱',
            content: '누구나 자유롭게 익명으로 마음을 남길 수 있어서 너무 좋아요! 감성 포스트잇 디자인 대박입니다 👍',
            color: 'mint',
            created_at: new Date(Date.now() - 3600000 * 24).toISOString()
        }
    ];
    renderNotes(allNotes);
}

// 실행 시작
document.addEventListener('DOMContentLoaded', init);

