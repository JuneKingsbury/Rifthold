import { BUILDINGS } from '../core/config.js';

const TUTORIAL_STEPS = [
    {
        id: 'gather',
        title: 'Gather Resources',
        description: 'Designate trees or rocks for your colonists to harvest. Press [G] or click Gather in the mode bar, then drag over trees or rocks.',
        highlight: 'gather',
        isComplete(game) { return !!game.tutorial.flags.gathered; },
        goTo(game) { game.input.setMode('designate'); },
    },
    {
        id: 'workbench',
        title: 'Build a Workbench',
        description: 'A Workbench lets you craft planks, tools, and weapons. Press [B] to Build, select "Production", and place a Workbench.',
        highlight: 'build',
        isComplete(game) { return game.mapIndex.getStructurePositions('workbench').size > 0; },
        goTo(game) {
            game.input.buildCategory = 'Production';
            game.input.buildOptions = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].category === 'Production');
            game.input.buildType = 'workbench';
            game.input.setMode('build');
        },
    },
    {
        id: 'craft_planks',
        title: 'Craft Planks',
        description: 'Open Craft [C] and queue a "Planks" order. Colonists will turn 2 wood into 3 planks at the workbench.',
        highlight: 'craft',
        isComplete(game) { return !!game.tutorial.flags.craftedPlanks; },
        goTo(game) { game.ui.toggleCraftPanel(); },
    },
    {
        id: 'farm',
        title: 'Plant a Farm',
        description: "Your starting food won't last long. Press [F] to Farm, then drag on grass to plant wheat or berries. Colonists handle planting and harvesting automatically.",
        highlight: 'zone',
        isComplete(game) { return game.mapIndex.zones.size > 0; },
        goTo(game) { game.input.setMode('zone'); },
    },
    {
        id: 'cauldron',
        title: 'Build a Cauldron',
        description: 'Raw crops must be cooked into meals. A Cauldron (3 stone, 1 wood) lets colonists cook food that is more filling and gives a mood bonus.',
        highlight: 'build',
        isComplete(game) { return game.mapIndex.getStructurePositions('cauldron').size > 0; },
        goTo(game) {
            game.input.buildCategory = 'Production';
            game.input.buildOptions = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].category === 'Production');
            game.input.buildType = 'cauldron';
            game.input.setMode('build');
        },
    },
    {
        id: 'cook',
        title: 'Cook a Meal',
        description: 'Open Craft [C] and queue "Cook Meal" (5 foodstuffs → 4 cooked food). Meals restore more hunger and give a mood bonus. Tip: set an auto-cook target in Settings.',
        highlight: 'craft',
        isComplete(game) { return !!game.tutorial.flags.cookedMeal; },
        goTo(game) { game.ui.toggleCraftPanel(); },
    },
    {
        id: 'research_desk',
        title: 'Build a Research Desk',
        description: 'A Research Desk generates research points to unlock new technologies. Build one from the Production tab (5 wood, 3 stone, 2 planks).',
        highlight: 'build',
        isComplete(game) { return game.mapIndex.getStructurePositions('research_desk').size > 0; },
        goTo(game) {
            game.input.buildCategory = 'Production';
            game.input.buildOptions = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].category === 'Production');
            game.input.buildType = 'research_desk';
            game.input.setMode('build');
        },
    },
    {
        id: 'research',
        title: 'Start Researching',
        description: "Open Research [R] and pick a technology to study. Stonework, Runecraft, and Druidcraft have no prerequisites so pick whichever sounds useful!",
        highlight: 'research',
        isComplete(game) { return game.research.activeResearch !== null || game.research.completed.size > 0; },
        goTo(game) { game.ui.toggleResearchPanel(); },
    },
    {
        id: 'weapon',
        title: 'Craft a Weapon',
        description: 'Open Craft [C], find the Weapons section, and craft any weapon. Your colonists will need to defend themselves from raiders eventually.',
        highlight: 'craft',
        isComplete(game) {
            if (game.resources.weapons.length > 0) return true;
            return game.colonists.some(c => c.weapon && c.weapon.key !== 'fists');
        },
        goTo(game) { game.ui.toggleCraftPanel(); },
    },
    {
        id: 'equip',
        title: 'Equip a Colonist',
        description: 'Click a colonist to select them, then click an empty equipment slot in their info panel to equip your crafted weapon. Equipped tools also boost work speed.',
        highlight: null,
        isComplete(game) {
            return game.colonists.some(c => c.weapon || c.armor || c.helmet || c.tool);
        },
        goTo(game) {
            const col = game.colonists.find(c => c.hp > 0);
            if (col) {
                game.selectedColonist = col.id;
                game.selectedColonists = [col.id];
                game.ui.update();
            }
        },
    },
    {
        id: 'bedroom',
        title: 'Build a Bedroom',
        description: 'Build an enclosed room (walls on all sides + a door) with a Bed inside. Valid bedrooms give colonists an ongoing mood bonus when they sleep.',
        highlight: 'build',
        isComplete(game) {
            return Object.keys(game.roomQualities).length > 0;
        },
        goTo(game) {
            game.input.buildCategory = 'Walls & Floors';
            game.input.buildOptions = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].category === 'Walls & Floors');
            game.input.buildType = 'wood_wall';
            game.input.setMode('build');
        },
    },
];

export class TutorialSystem {
    constructor() {
        this.currentStep = 0;
        this.completed = new Set();
        this.flags = {};
        this._lastRenderedStep = -1;
    }

    get totalSteps() { return TUTORIAL_STEPS.length; }

    getCurrentTask() {
        if (this.currentStep >= TUTORIAL_STEPS.length) return null;
        return TUTORIAL_STEPS[this.currentStep];
    }

    isFinished() {
        return this.currentStep >= TUTORIAL_STEPS.length;
    }

    update(game) {
        if (!game.settings.showTutorial) return;
        if (this.isFinished()) return;

        let advanced = false;
        while (this.currentStep < TUTORIAL_STEPS.length) {
            const step = TUTORIAL_STEPS[this.currentStep];
            if (step.isComplete(game)) {
                this.completed.add(this.currentStep);
                this.currentStep++;
                advanced = true;
            } else {
                break;
            }
        }

        if (advanced && game.ui) {
            game.ui.updateTutorialNote(game);
            game.ui.updateModeDisplay(game.input);
        }
    }

    getHighlight() {
        const task = this.getCurrentTask();
        return task ? task.highlight : null;
    }

    goTo(game) {
        const task = this.getCurrentTask();
        if (task) task.goTo(game);
    }
}
