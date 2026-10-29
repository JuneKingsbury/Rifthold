import { installTutorialPointer } from './ui-tutorial-pointer.js';
import { escapeHtml } from './ui-utils.js';

export function installTutorialPanel(UI) {
    Object.assign(UI.prototype, tutorialMethods);
    installTutorialPointer(UI);
}

// Shows "[F]" style hints as keycaps so they stand out from the sentence.
function withKeycaps(text) {
    return text.replace(/\[([A-Za-z0-9,./<>+-]{1,8})\]/g, '<kbd>$1</kbd>');
}

const tutorialMethods = {
    initTutorialNote() {
        this._tutorialExpanded = true;
        this._tutorialEl = document.getElementById('tutorial-note');
        if (!this._tutorialEl) return;
        this._listen(this._tutorialEl, 'click', (e) => {
            const cls = e.target.classList;
            if (cls.contains('tutorial-collapse')) {
                this._tutorialExpanded = false;
                this.updateTutorialNote(this.game);
            } else if (cls.contains('tutorial-expand')) {
                this._tutorialExpanded = true;
                this.updateTutorialNote(this.game);
            } else if (cls.contains('tutorial-goto')) {
                this.game.tutorial.goTo(this.game);
            } else if (cls.contains('tutorial-ack')) {
                this.game.tutorial.acknowledge(this.game);
            } else if (cls.contains('tutorial-skip')) {
                this.game.tutorial.skip(this.game);
            }
        });
        this.initTutorialPointer();
    },

    updateTutorialNote(game) {
        const el = this._tutorialEl;
        if (!el) return;

        const tutorial = game.tutorial;
        if (!game.settings.showTutorial || tutorial.isFinished()) {
            el.style.display = 'none';
            this._tutorialHtml = null;
            return;
        }

        const toggle = this._tutorialExpanded
            ? '<span class="tutorial-collapse">&minus;</span>'
            : '<span class="tutorial-expand">+</span>';
        let html;

        if (tutorial.isChecklist) {
            const done = tutorial.completedCount;
            html = `<div class="tutorial-header"><span class="tutorial-step">Goals ${done}/${tutorial.totalSteps}</span>${toggle}</div>`;
            if (this._tutorialExpanded) {
                html += '<ul class="tutorial-goals">';
                for (const goal of tutorial.steps) {
                    const isDone = tutorial.completed.has(goal.id);
                    html += `<li class="${isDone ? 'done' : ''}">${isDone ? '&#10003;' : '&#9744;'} ${withKeycaps(goal.title)}</li>`;
                }
                html += '</ul>';
            }
        } else {
            const task = tutorial.getCurrentTask();
            if (!task) {
                el.style.display = 'none';
                this._tutorialHtml = null;
                return;
            }
            const step = tutorial.currentStep + 1;
            const total = tutorial.totalSteps;
            const pct = Math.round((tutorial.currentStep / total) * 100);
            html = `<div class="tutorial-header"><span class="tutorial-step">${step}/${total}</span>${toggle}</div>`
                + `<div class="tutorial-progress"><div class="tutorial-progress-fill" style="width:${pct}%"></div></div>`
                + `<div class="tutorial-title">${escapeHtml(task.title)}</div>`;
            if (this._tutorialExpanded) {
                html += `<div class="tutorial-desc">${withKeycaps(tutorial.getDescription(task))}</div>`;
                const help = tutorial.getHelpText(game);
                if (help) html += `<div class="tutorial-help">${help}</div>`;
                html += task.manual
                    ? '<button class="tutorial-ack">Got it &rarr;</button>'
                    : '<button class="tutorial-goto">Go to &rarr;</button>';
                if (!task.manual) html += '<div class="tutorial-skip">Skip this step</div>';
            }
        }

        el.style.display = 'block';
        el.classList.toggle('expanded', this._tutorialExpanded);
        // The note is refreshed on a timer, so only touch the DOM when its content changed.
        // Replacing it every tick would eat clicks that land mid-update.
        if (html !== this._tutorialHtml) {
            this._tutorialHtml = html;
            el.innerHTML = html;
        }
    },
};
