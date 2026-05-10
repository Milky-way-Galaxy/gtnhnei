import { addProjectChangeListener } from "./page.js";
export class Dropdown {
    constructor() {
        this.currentTarget = null;
        this.currentPopulateCallback = null;
        this.dropdown = document.getElementById("dropdown");
        // Hide dropdown when clicking anywhere
        document.addEventListener("click", (e) => {
            if (this.currentTarget) {
                // Ignore clicks on the target element that triggered the dropdown
                // or any of its children
                if (e.target === this.currentTarget ||
                    this.currentTarget.contains(e.target) ||
                    this.dropdown.contains(e.target)) {
                    return;
                }
                this.hide();
            }
        });
        // Register a single project change listener
        addProjectChangeListener(() => {
            if (this.isVisible() && this.currentPopulateCallback) {
                this.currentPopulateCallback(this.dropdown);
            }
        });
    }
    static getInstance() {
        if (!Dropdown.instance) {
            Dropdown.instance = new Dropdown();
        }
        return Dropdown.instance;
    }
    getDropdownElement() {
        return this.dropdown;
    }
    show(target, populateCallback) {
        this.currentTarget = target;
        this.currentPopulateCallback = populateCallback;
        // Clear previous content
        this.dropdown.innerHTML = "";
        // Call the provided callback to populate the dropdown
        populateCallback(this.dropdown);
        this.dropdown.style.display = "block";
        // Position the dropdown
        // Needs reduced set here for some reason.
        this.dropdown.style.zIndex = "10000";
        const targetRect = target.getBoundingClientRect();
        const dropdownRect = this.dropdown.getBoundingClientRect();
        // Check if there's enough space below
        // Save some space for dynamic parts of the dropdown.
        const spaceBelow = window.innerHeight - targetRect.bottom - 50;
        this.dropdown.style.top = `${targetRect.bottom - Math.max(0, (dropdownRect.height - spaceBelow))}px`;
        this.dropdown.style.left = `${targetRect.right + Math.max(0, (targetRect.width - dropdownRect.width) / 2)}px`;
    }
    hide() {
        this.currentTarget = null;
        this.currentPopulateCallback = null;
        this.dropdown.style.display = "none";
    }
    isVisible() {
        return this.dropdown.style.display === "block";
    }
}
export function ShowDropdown(target, populateCallback) {
    Dropdown.getInstance().show(target, populateCallback);
}
export function HideDropdown() {
    Dropdown.getInstance().hide();
}
//# sourceMappingURL=dropdown.js.map