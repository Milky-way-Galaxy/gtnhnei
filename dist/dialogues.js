export function showConfirmDialog(text, option1Text = "Yes", option2Text = "No", cancelText = null) {
    console.log("showConfirmDialog", text, option1Text, option2Text, cancelText);
    return new Promise((resolve) => {
        const dialog = document.getElementById('confirm-dialog');
        const textElement = document.getElementById('confirm-text');
        const option1Button = document.getElementById('confirm-yes');
        const option2Button = document.getElementById('confirm-no');
        const cancelButton = document.getElementById('confirm-cancel');
        if (!dialog || !textElement || !option1Button || !option2Button || !cancelButton) {
            resolve('cancel');
            return;
        }
        // Set the text
        textElement.textContent = text;
        // Set button text and visibility
        const setButtonVisibility = (button, text) => {
            if (text) {
                button.textContent = text;
                button.classList.remove('hidden');
            }
            else {
                button.classList.add('hidden');
            }
            ;
        };
        setButtonVisibility(option1Button, option1Text);
        setButtonVisibility(option2Button, option2Text);
        setButtonVisibility(cancelButton, cancelText);
        // Set up event listeners
        const handleClick = (result) => {
            dialog.classList.add('hidden');
            resolve(result);
        };
        option1Button.onclick = () => handleClick('option1');
        option2Button.onclick = () => handleClick('option2');
        cancelButton.onclick = () => handleClick('cancel');
        // Show the dialog
        dialog.classList.remove('hidden');
    });
}
//# sourceMappingURL=dialogues.js.map