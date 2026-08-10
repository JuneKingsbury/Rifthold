export function initResizeHandles(onResize) {
    initInfoPanelResize(onResize);
    initFooterResize(onResize);
    initFooterPanelResizes();

    const mq = window.matchMedia('(max-width: 768px)');
    function handleMobileSwitch(e) {
        if (e.matches) {
            document.getElementById('game-container').style.gridTemplateColumns = '';
        }
    }
    mq.addEventListener('change', handleMobileSwitch);
    handleMobileSwitch(mq);
}

function initInfoPanelResize(onResize) {
    const handle = document.getElementById('info-resize-handle');
    if (!handle) return;

    const container = document.getElementById('game-container');
    let startX, startWidth;

    function onPointerDown(e) {
        e.preventDefault();
        const panel = document.getElementById('info-panel');
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        handle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
        const dx = startX - e.clientX;
        const newWidth = Math.max(120, Math.min(window.innerWidth * 0.5, startWidth + dx));
        container.style.gridTemplateColumns = `1fr ${newWidth}px`;
        onResize();
    }

    function onPointerUp() {
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        window.resetMinimapSize?.();
    }

    handle.addEventListener('pointerdown', onPointerDown);
}

function initFooterResize(onResize) {
    const handle = document.getElementById('footer-resize-handle');
    if (!handle) return;

    const footer = document.getElementById('game-footer');
    let startY, startHeight;

    function onPointerDown(e) {
        e.preventDefault();
        footer.classList.remove('collapsed');
        startY = e.clientY;
        startHeight = footer.offsetHeight;
        handle.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
        const dy = startY - e.clientY;
        const newHeight = Math.max(24, Math.min(window.innerHeight * 0.6, startHeight + dy));
        footer.style.height = newHeight + 'px';
        onResize();
    }

    function onPointerUp() {
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        window.resetMinimapSize?.();
    }

    handle.addEventListener('pointerdown', onPointerDown);
}

function initFooterPanelResizes() {
    const handles = document.querySelectorAll('.footer-panel-resize');
    for (const handle of handles) {
        initPanelResizeHandle(handle);
    }
}

function initPanelResizeHandle(handle) {
    const leftId = handle.dataset.resizeLeft;
    const rightId = handle.dataset.resizeRight;
    const leftPanel = document.getElementById(leftId);
    const rightPanel = document.getElementById(rightId);
    if (!leftPanel || !rightPanel) return;

    let startX, startLeftWidth, startRightWidth;

    function onPointerDown(e) {
        e.preventDefault();
        startX = e.clientX;
        startLeftWidth = leftPanel.offsetWidth;
        startRightWidth = rightPanel.offsetWidth;
        handle.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
        const dx = e.clientX - startX;
        const newLeft = startLeftWidth + dx;
        const newRight = startRightWidth - dx;
        if (newLeft < 60 || newRight < 60) return;
        leftPanel.style.flex = `0 0 ${newLeft}px`;
        rightPanel.style.flex = `0 0 ${newRight}px`;
    }

    function onPointerUp() {
        handle.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
    }

    handle.addEventListener('pointerdown', onPointerDown);
}
