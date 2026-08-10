export function installTutorialPanel(UI) {
    Object.assign(UI.prototype, tutorialMethods);
}

const tutorialMethods = {
    initTutorialNote() {
        this._tutorialExpanded = true;
        this._tutorialEl = document.getElementById('tutorial-note');
        if (!this._tutorialEl) return;
        this._tutorialEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('tutorial-collapse')) {
                this._tutorialExpanded = false;
                this.updateTutorialNote(this.game);
                return;
            }
            if (e.target.classList.contains('tutorial-expand')) {
                this._tutorialExpanded = true;
                this.updateTutorialNote(this.game);
                return;
            }
            if (e.target.classList.contains('tutorial-goto')) {
                this.game.tutorial.goTo(this.game);
                return;
            }
        });
    },

    updateTutorialNote(game) {
        const el = this._tutorialEl;
        if (!el) return;

        if (!game.settings.showTutorial || game.tutorial.isFinished()) {
            el.style.display = 'none';
            return;
        }

        const task = game.tutorial.getCurrentTask();
        if (!task) {
            el.style.display = 'none';
            return;
        }

        el.style.display = 'block';
        const step = game.tutorial.currentStep + 1;
        const total = game.tutorial.totalSteps;

        if (this._tutorialExpanded) {
            el.innerHTML = `<div class="tutorial-header"><span class="tutorial-step">${step}/${total}</span><span class="tutorial-collapse">&minus;</span></div>`
                + `<div class="tutorial-title">${task.title}</div>`
                + `<div class="tutorial-desc">${task.description}</div>`
                + `<button class="tutorial-goto">Go to &rarr;</button>`;
            el.classList.add('expanded');
        } else {
            el.innerHTML = `<div class="tutorial-header"><span class="tutorial-step">${step}/${total}</span><span class="tutorial-expand">+</span></div>`
                + `<div class="tutorial-title">${task.title}</div>`;
            el.classList.remove('expanded');
        }
    },
};
