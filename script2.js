// script2.js
// This file handles the lucky wheel functionality, including gift button, wheel drawing, spinning logic,
// reward management for admins, and user spin eligibility.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, query, where, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment (assuming they are set up similarly to script.js)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyAJmYFnLAhskjszeK5DZve4z0wRXrXl7Sc",
    authDomain: "iphonechinhhang-47bdd.firebaseapp.com",
    projectId: "iphonechinhhang-47bdd",
    storageBucket: "iphonechinhhang-47bdd.firebasestorage.app",
    messagingSenderId: "308005027963",
    appId: "1:308005027963:web:35afe47c3ace690e38e2de",
    measurementId: "G-PQ7450T99T"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Global variables to be shared or accessed from script.js context (if needed, but generally avoid direct access for separation)
// For this script, we will re-initialize `loggedInUser` and `shopDataCache` listeners to be self-contained.
let loggedInUser = null;
let currentUserId = null;
let shopDataCache = {
    products: [],
    vouchers: {}, // Vouchers are now directly used for spin codes as well
    rewards: [] // Array to store lucky wheel rewards
};

// UI Elements
const giftButton = document.getElementById('gift-button');
const luckyWheelModal = document.getElementById('lucky-wheel-modal');
const closeLuckyWheelModalBtn = document.getElementById('close-lucky-wheel-modal');
const luckyWheelCanvas = document.getElementById('lucky-wheel-canvas');
const spinButton = document.getElementById('spin-button');
const prizeResultDiv = document.getElementById('prize-result');
const wonPrizeNameSpan = document.getElementById('won-prize-name');
const voucherDisplayArea = document.getElementById('voucher-display-area');
const wonVoucherCodeSpan = document.getElementById('won-voucher-code');
const wonVoucherValueSpan = document.getElementById('won-voucher-value');
const wonVoucherExpirySpan = document.getElementById('won-voucher-expiry');
const copyVoucherBtn = document.getElementById('copy-voucher-btn');
const itemDisplayArea = document.getElementById('item-display-area');
const wonItemImage = document.getElementById('won-item-image');
const wonItemName = document.getElementById('won-item-name');
const spinCountDisplay = document.getElementById('spin-count-display');
const currentSpinCountSpan = document.getElementById('current-spin-count');
const luckyWheelMessage = document.getElementById('lucky-wheel-message');

// New UI Elements for Spin Voucher Entry
const spinVoucherEntryModal = document.getElementById('spin-voucher-entry-modal');
const closeSpinVoucherModalBtn = document.getElementById('close-spin-voucher-modal');
const spinVoucherCodeInput = document.getElementById('spin-voucher-code-input');
const applySpinVoucherBtn = document.getElementById('apply-spin-voucher-btn');
const spinVoucherErrorMessage = document.getElementById('spin-voucher-error-message');


// Admin reward management elements
const openManagementModalBtn = document.getElementById('open-management-modal-btn'); // From script.js, listen to its click indirectly
const shopManagementModal = document.getElementById('shop-management-modal'); // From script.js
const addEditRewardForm = document.getElementById('add-edit-reward-form');
const editRewardIdInput = document.getElementById('edit-reward-id');
const newRewardNameInput = document.getElementById('new-reward-name');
const newRewardTypeSelect = document.getElementById('new-reward-type');
const rewardValueContainer = document.getElementById('reward-value-container');
const newRewardValueInput = document.getElementById('new-reward-value');
const rewardImageContainer = document.getElementById('reward-image-container');
const newRewardImageInput = document.getElementById('new-reward-image');
const newRewardChanceInput = document.getElementById('new-reward-chance');
const submitRewardBtn = document.getElementById('submit-reward-btn');
const cancelEditRewardBtn = document.getElementById('cancel-edit-reward-btn');
const currentRewardsList = document.getElementById('current-rewards-list');

// Canvas and Wheel related variables
const ctx = luckyWheelCanvas.getContext('2d');
let arc = Math.PI / 0; // Will be set dynamically based on number of segments
let spinTimeout = null;
let spinAngleStart = 10; // Initial spin speed
let spinTime = 0;
let spinTimeTotal = 0;
let spinDirection = 1; // 1 for clockwise, -1 for counter-clockwise
let spinning = false;

// Utility functions
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') return amount; // Handle non-numeric for freeship etc.
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Loading overlay elements (copied from script.js for self-containment)
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingIndicator';
loadingOverlay.className = 'loading-overlay hidden';
loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
document.body.appendChild(loadingOverlay);

function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

function showMessage(message, type = 'info') {
    const messageDisplay = document.getElementById('messageDisplay'); // Re-use from script.js if it exists, or create
    if (!messageDisplay) {
        const tempMsg = document.createElement('div');
        tempMsg.id = 'messageDisplay';
        tempMsg.className = 'message hidden fixed top-24 right-6 p-4 rounded-lg shadow-lg z-50';
        document.body.appendChild(tempMsg);
    }
    messageDisplay.textContent = message;
    messageDisplay.className = `message ${type} fixed top-24 right-6 p-4 rounded-lg shadow-lg z-50`;
    messageDisplay.classList.remove('hidden');
    setTimeout(() => {
        messageDisplay.classList.add('hidden');
        messageDisplay.textContent = '';
        messageDisplay.className = 'message hidden fixed top-24 right-6 p-4 rounded-lg shadow-lg z-50';
    }, 3000);
}

function openModal(modalElement) {
    modalElement.classList.remove('hidden');
    modalElement.classList.add('active');
    document.body.classList.add('overflow-hidden');
}

function closeModal(modalElement) {
    modalElement.classList.remove('active');
    const transitionDuration = parseFloat(getComputedStyle(modalElement).transitionDuration) * 1000;

    let transitionEndFired = false;
    const onTransitionEnd = () => {
        transitionEndFired = true;
        modalElement.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        modalElement.removeEventListener('transitionend', onTransitionEnd);
    };

    modalElement.addEventListener('transitionend', onTransitionEnd);

    setTimeout(() => {
        if (!transitionEndFired) {
            modalElement.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
            modalElement.removeEventListener('transitionend', onTransitionEnd);
        }
    }, transitionDuration + 100);
}

// Confetti Effect
function createConfetti() {
    const confettiContainer = document.getElementById('confetti-container');
    confettiContainer.classList.remove('hidden');
    const colors = ['#f00', '#0f0', '#00f', '#ff0', '#0ff', '#f0f'];
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confettiContainer.appendChild(confetti);
    }
    setTimeout(() => {
        confettiContainer.innerHTML = '';
        confettiContainer.classList.add('hidden');
    }, 3000);
}

// --- Lucky Wheel Drawing and Spinning Logic ---

function drawWheel() {
    if (!luckyWheelCanvas) return;

    const rewards = shopDataCache.rewards;
    const numSegments = rewards.length;
    arc = 2 * Math.PI / numSegments; // Angle for each segment

    ctx.clearRect(0, 0, luckyWheelCanvas.width, luckyWheelCanvas.height);

    for (let i = 0; i < numSegments; i++) {
        const angle = i * arc;
        ctx.beginPath();
        // Draw segment
        ctx.arc(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2, luckyWheelCanvas.width / 2, angle, angle + arc);
        ctx.lineTo(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2);
        // Fill based on index for variety
        ctx.fillStyle = `hsl(${i * (360 / numSegments) + 30}, 70%, 70%)`; // Dynamic color
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2);
        ctx.rotate(angle + arc / 2 + Math.PI / 2); // Rotate text to be upright, adjusted for segment position
        ctx.fillStyle = '#fff';
        ctx.font = '16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const rewardName = rewards[i].name;
        // Adjust text position based on reward image presence
        const textY = rewards[i].image ? -luckyWheelCanvas.width / 2 + 30 : -luckyWheelCanvas.width / 2 + 20;
        ctx.fillText(rewardName, 0, textY, luckyWheelCanvas.width * 0.4); // Limit text width

        // Draw image if available
        if (rewards[i].image) {
            const img = new Image();
            img.onload = () => {
                // To avoid drawing multiple times on redraws, consider clearing a specific area or managing images better
                // For simplicity here, we'll redraw on load.
                // Redraw the specific segment with the image
                ctx.save();
                ctx.translate(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2);
                ctx.rotate(angle + arc / 2 + Math.PI / 2); // Same rotation as text
                const imgSize = 40; // Size of the image
                const imgX = -imgSize / 2;
                const imgY = -luckyWheelCanvas.width / 2 + 55; // Position below text
                ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
                ctx.restore();
            };
            img.onerror = () => {
                console.warn(`Could not load image for reward ${rewards[i].name}: ${rewards[i].image}`);
                // Draw a placeholder if image fails to load
                ctx.save();
                ctx.translate(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2);
                ctx.rotate(angle + arc / 2 + Math.PI / 2);
                ctx.fillStyle = '#999';
                ctx.font = '10px Inter, sans-serif';
                ctx.fillText('No Image', 0, -luckyWheelCanvas.width / 2 + 55);
                ctx.restore();
            };
            img.src = rewards[i].image;
        }

        ctx.restore();
    }

    drawIndicator(); // Draw the fixed pointer
}

function drawIndicator() {
    // Draw a fixed triangle indicator at the top center of the canvas, pointing downwards
    // This indicator will be fixed, and the wheel will spin underneath it.
    ctx.save();
    ctx.translate(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2); // Move origin to center of wheel
    ctx.beginPath();
    ctx.moveTo(0, -luckyWheelCanvas.height / 2 - 20); // Top point, above the wheel
    ctx.lineTo(-15, -luckyWheelCanvas.height / 2 + 0); // Bottom-left point, just touching the wheel edge
    ctx.lineTo(15, -luckyWheelCanvas.height / 2 + 0); // Bottom-right point, just touching the wheel edge
    ctx.closePath();
    ctx.fillStyle = 'red';
    ctx.fill();
    ctx.restore();
}

function spin() {
    spinButton.disabled = true;
    prizeResultDiv.classList.add('hidden');
    voucherDisplayArea.classList.add('hidden');
    itemDisplayArea.classList.add('hidden');
    luckyWheelMessage.classList.add('hidden');

    spinTime = 0;
    spinTimeTotal = Math.random() * 3000 + 4000; // Spin for 4-7 seconds
    spinAngleStart = 10; // Initial spin speed. This will be adjusted to ensure a specific landing.

    // Determine the winning segment index based on chances
    let winningIndex = -1;
    const totalChance = shopDataCache.rewards.reduce((sum, reward) => sum + reward.chance, 0);

    if (totalChance > 0) {
        let random = Math.random() * totalChance;
        let cumulativeChance = 0;
        for (let i = 0; i < shopDataCache.rewards.length; i++) {
            cumulativeChance += shopDataCache.rewards[i].chance;
            if (random < cumulativeChance) {
                winningIndex = i;
                break;
            }
        }
    }

    // Fallback if no prize is won due to chance distribution, or if rewards list is empty.
    // If rewards are empty, this should have been caught earlier.
    if (winningIndex === -1 && shopDataCache.rewards.length > 0) {
        const thankYouIndex = shopDataCache.rewards.findIndex(r => r.type === 'thankyou');
        winningIndex = thankYouIndex !== -1 ? thankYouIndex : Math.floor(Math.random() * shopDataCache.rewards.length);
    } else if (shopDataCache.rewards.length === 0) {
        showMessage('Không có phần thưởng nào để quay.', 'error');
        spinButton.disabled = false;
        return;
    }

    // Calculate the target angle for the winning segment to land at the indicator.
    const numSegments = shopDataCache.rewards.length;
    const segmentArc = 2 * Math.PI / numSegments; // Angle of each segment
    
    // The indicator points at the "12 o'clock" position (which is -Math.PI / 2 or 3 * Math.PI / 2 radians).
    // The segments are drawn starting from 0 radians (3 o'clock).
    // So, we need the *center* of the winning segment (`winningIndex * segmentArc + segmentArc / 2`)
    // to align with the indicator's position relative to the wheel's starting point.
    // Let's say the indicator is at the top (0 radians or 2*PI in the drawing context)
    // and the wheel segments start from the right (0 radians in drawing context).
    // The segment `i` is from `i*arc` to `(i+1)*arc`. Its center is `i*arc + arc/2`.
    // We want this center to align with the top. So, the total rotation needed will be:
    // `(2 * Math.PI) - (winningIndex * segmentArc + segmentArc / 2)` plus N full rotations.
    // A slight offset (e.g., PI/2) might be needed depending on how segments are drawn relative to the 'top'.

    // Let's assume segment 0 is at 3 o'clock. We want the center of the winning segment to stop at 12 o'clock.
    // The angle of the center of segment `winningIndex` is `winningIndex * arc + arc / 2`.
    // The indicator is at `Math.PI * 1.5` (270 degrees) or `-Math.PI / 2` (90 degrees counter-clockwise from positive x-axis).
    // If our drawing context treats 0 degrees as 3 o'clock, and we want it to land at 12 o'clock (top),
    // which is `Math.PI / 2` counter-clockwise from 3 o'clock.
    // So, the total rotation needed is `(currentAngle - targetSegmentCenterAngle + 2 * Math.PI) % (2 * Math.PI)`.

    const targetSegmentCenterAngle = winningIndex * segmentArc + segmentArc / 2;
    const indicatorAngle = Math.PI * 1.5; // Fixed indicator at 12 o'clock (270 degrees)
    
    // Calculate the required rotation so that the targetSegmentCenterAngle aligns with the indicatorAngle
    let rotationToAlign = indicatorAngle - targetSegmentCenterAngle;

    // Normalize rotationToAlign to be within 0 to 2*PI
    rotationToAlign = (rotationToAlign + 2 * Math.PI) % (2 * Math.PI);

    // Add multiple full rotations to make it spin sufficiently
    const numberOfFullSpins = 5; // Spin at least 5 full times
    let finalRotationRadians = rotationToAlign + (numberOfFullSpins * 2 * Math.PI);

    // Apply a random offset within a small margin of the target to make it less predictable
    const randomStopOffset = (Math.random() - 0.5) * (segmentArc * 0.5); // +/- 25% of a segment
    finalRotationRadians += randomStopOffset;

    // Store the final calculated rotation (in degrees) in the canvas style
    luckyWheelCanvas.style.transition = `transform ${spinTimeTotal / 1000}s ease-out`; // Smooth deceleration
    luckyWheelCanvas.style.transform = `rotate(-${finalRotationRadians * 180 / Math.PI}deg)`; // Negative for clockwise spin effect

    // Set a timeout to call stopRotateWheel after the transition finishes
    spinTimeout = setTimeout(() => {
        stopRotateWheel(winningIndex); // Pass winning index directly
    }, spinTimeTotal);
}


function stopRotateWheel(winningIndex) {
    clearTimeout(spinTimeout); // Clear any lingering timeout
    spinning = false;

    // The winningIndex is already known from the spin() function, so we can use it directly.
    const wonReward = shopDataCache.rewards[winningIndex];
    displayWonPrize(wonReward);
    handleRewardOutcome(wonReward);

    // Disable spin button after spin
    spinButton.disabled = true;
    spinButton.textContent = 'Đã quay xong';
    giftButton.classList.add('disabled'); // Disable gift button after use
}

function displayWonPrize(reward) {
    prizeResultDiv.classList.remove('hidden');
    wonPrizeNameSpan.textContent = reward.name;
    createConfetti(); // Show confetti effect

    if (reward.type === 'voucher') {
        voucherDisplayArea.classList.remove('hidden');
        wonVoucherCodeSpan.textContent = reward.value;
        const voucher = shopDataCache.vouchers[reward.value]; // Get actual voucher details
        if (voucher) {
            wonVoucherValueSpan.textContent = `Giá trị: ${voucher.displayValue}`;
            wonVoucherExpirySpan.textContent = `Hạn sử dụng: ${new Date(voucher.expiry).toLocaleString('vi-VN')}`;
        } else {
            wonVoucherValueSpan.textContent = 'Thông tin voucher không có sẵn.';
            wonVoucherExpirySpan.textContent = '';
        }
        itemDisplayArea.classList.add('hidden');
    } else if (reward.type === 'item') {
        itemDisplayArea.classList.remove('hidden');
        wonItemName.textContent = reward.name;
        wonItemImage.src = reward.image || 'https://placehold.co/100x100/cccccc/333333?text=Item';
        voucherDisplayArea.classList.add('hidden');
    } else {
        voucherDisplayArea.classList.add('hidden');
        itemDisplayArea.classList.add('hidden');
    }
}

async function handleRewardOutcome(reward) {
    if (!loggedInUser || !loggedInUser.id) {
        showMessage('Vui lòng đăng nhập để nhận phần thưởng!', 'error');
        return;
    }

    // Handle reward specific actions
    if (reward.type === 'voucher' && reward.value) {
        showMessage(`Bạn đã trúng voucher: ${reward.value}!`, 'success');
    } else if (reward.type === 'item' && reward.value) {
        // Add item to user's cart
        const productId = reward.value;
        const itemQuantity = 1; // Assuming one item per spin
        const product = shopDataCache.products.find(p => p.id === productId);

        if (product) {
            let userCartData = [];
            try {
                const cartDocSnap = await getDoc(doc(db, `artifacts/${appId}/users/${loggedInUser.id}/cart`, 'currentCart'));
                if (cartDocSnap.exists()) {
                    userCartData = cartDocSnap.data().items || [];
                }
            } catch (error) {
                console.error("Error fetching user cart for item reward:", error);
                showMessage("Lỗi khi tải giỏ hàng để thêm sản phẩm.", "error");
                return;
            }

            const existingCartItemIndex = userCartData.findIndex(item =>
                item.productId === productId
            );

            if (existingCartItemIndex > -1) {
                userCartData[existingCartItemIndex].quantity += itemQuantity;
            } else {
                let priceAtAddToCart = product.basePrice;
                let originalPriceForVAT = product.basePrice;

                if (product.variants && product.variants.length > 0) {
                    const defaultVariant = product.variants[0];
                    priceAtAddToCart += (defaultVariant.priceImpact || 0);
                    originalPriceForVAT += (defaultVariant.priceImpact || 0);
                }

                userCartData.push({
                    productId: product.id,
                    productName: product.name,
                    productImage: reward.image || product.image,
                    selectedColor: null,
                    selectedStorage: null,
                    priceAtAddToCart: priceAtAddToCart,
                    originalPriceForVAT: originalPriceForVAT,
                    quantity: itemQuantity
                });
            }

            try {
                await setDoc(doc(db, `artifacts/${appId}/users/${loggedInUser.id}/cart`, 'currentCart'), { items: userCartData });
                showMessage(`Sản phẩm "${product.name}" đã được thêm vào giỏ hàng của bạn!`, 'success');
            } catch (error) {
                console.error("Error adding item to cart from reward:", error);
                showMessage(`Lỗi khi thêm sản phẩm "${product.name}" vào giỏ hàng.`, 'error');
            }
        } else {
            showMessage(`Không tìm thấy thông tin sản phẩm cho phần thưởng: ${reward.name}`, 'error');
        }
    } else if (reward.type === 'freespin') {
        let currentSpins = await getUserSpins();
        currentSpins += parseInt(reward.value, 10); // Reward value is now number of spins
        await setUserSpins(currentSpins);
        showMessage(`Chúc mừng! Bạn đã nhận được ${reward.value} lượt quay miễn phí!`, 'success');
        updateSpinCountUI();
        spinButton.disabled = false;
        giftButton.classList.remove('disabled');
    } else if (reward.type === 'thankyou') {
        showMessage('Chúc bạn may mắn lần sau!', 'info');
    }

    // Decrement spin count AFTER handling reward outcome (if it wasn't a freespin)
    // This logic is now handled at the start of spin()
    // However, if the reward wasn't a freespin, the spins were already decremented.
    // So we just update the UI here.
    updateSpinCountUI();
}

// --- User Spin Eligibility & Count (now managed by vouchers) ---
async function getUserSpins() {
    if (!loggedInUser || !loggedInUser.id) {
        return 0; // No spins for logged out users
    }
    try {
        const userSpinStatusDocRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/rewardStatus`, 'spinEligibility');
        const docSnap = await getDoc(userSpinStatusDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.spins || 0;
        }
        return 0;
    } catch (error) {
        console.error("Error getting user spins:", error);
        return 0;
    }
}

async function setUserSpins(count) {
    if (!loggedInUser || !loggedInUser.id) {
        return;
    }
    try {
        const userSpinStatusDocRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/rewardStatus`, 'spinEligibility');
        await setDoc(userSpinStatusDocRef, { spins: count }, { merge: true });
        console.log(`User ${loggedInUser.id} spins set to ${count}`);
    } catch (error) {
        console.error("Error setting user spins:", error);
    }
}

async function hasUserUsedSpinVoucher(voucherCode) {
    if (!loggedInUser || !loggedInUser.id) {
        return true; // Assume used if not logged in to prevent guest abuse
    }
    try {
        const usedVoucherDocRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/usedVouchers`, voucherCode);
        const docSnap = await getDoc(usedVoucherDocRef);
        return docSnap.exists();
    } catch (error) {
        console.error("Error checking if spin voucher was used:", error);
        return true; // Err on the side of caution
    }
}

async function markSpinVoucherAsUsed(voucherCode) {
    if (!loggedInUser || !loggedInUser.id) {
        return;
    }
    try {
        const usedVoucherDocRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/usedVouchers`, voucherCode);
        await setDoc(usedVoucherDocRef, { redeemedAt: new Date().toISOString() });
        console.log(`Spin voucher ${voucherCode} marked as used by user ${loggedInUser.id}`);
    } catch (error) {
        console.error("Error marking spin voucher as used:", error);
    }
}


// Simplified, grantSpinIfEligible now just manages UI state based on `spins`
async function grantSpinIfEligible() {
    // This function is now mainly for updating UI state based on available spins,
    // not for granting spins based on orders. Spins are granted via vouchers.
    updateSpinCountUI();
    updateGiftButtonState();
}


function updateSpinCountUI() {
    getUserSpins().then(spins => {
        currentSpinCountSpan.textContent = spins;
        if (spins > 0 && !spinning) {
            spinButton.disabled = false;
            spinButton.textContent = 'QUAY NGAY!';
            luckyWheelMessage.classList.add('hidden');
        } else if (spins === 0 && !spinning) {
            spinButton.disabled = true;
            spinButton.textContent = 'Hết lượt quay';
            luckyWheelMessage.textContent = 'Bạn không có lượt quay nào. Vui lòng nhập mã quay hợp lệ.';
            luckyWheelMessage.classList.remove('hidden');
        }
    });
}

function updateGiftButtonState() {
    // Gift button is now always enabled to open the voucher input modal
    giftButton.classList.remove('disabled'); // Always allow opening the voucher input modal
}

// --- Event Listeners ---
giftButton.addEventListener('click', async () => {
    if (!loggedInUser || !loggedInUser.id) {
        showMessage('Vui lòng đăng nhập để tham gia vòng quay may mắn.', 'info');
        document.getElementById('login-register-modal').classList.remove('hidden');
        document.getElementById('login-register-modal').classList.add('active');
        return;
    }
    // Open the spin voucher entry modal first
    spinVoucherCodeInput.value = ''; // Clear previous input
    spinVoucherErrorMessage.classList.add('hidden'); // Hide any previous errors
    openModal(spinVoucherEntryModal);
});

// New Event Listener for Spin Voucher Entry Modal
closeSpinVoucherModalBtn.addEventListener('click', () => closeModal(spinVoucherEntryModal));
spinVoucherEntryModal.addEventListener('click', (e) => {
    if (e.target === spinVoucherEntryModal) closeModal(spinVoucherEntryModal);
});

applySpinVoucherBtn.addEventListener('click', async () => {
    if (!loggedInUser || !loggedInUser.id) {
        showMessage('Vui lòng đăng nhập để áp dụng mã quay.', 'info');
        return;
    }

    const voucherCode = spinVoucherCodeInput.value.trim().toUpperCase();
    if (!voucherCode) {
        spinVoucherErrorMessage.textContent = 'Vui lòng nhập mã vòng quay.';
        spinVoucherErrorMessage.classList.remove('hidden');
        return;
    }

    showLoading();
    try {
        const voucher = shopDataCache.vouchers[voucherCode];

        if (!voucher) {
            spinVoucherErrorMessage.textContent = 'Mã vòng quay không hợp lệ.';
            spinVoucherErrorMessage.classList.remove('hidden');
            hideLoading();
            return;
        }

        if (voucher.type !== 'spin') {
            spinVoucherErrorMessage.textContent = 'Đây không phải là mã vòng quay may mắn.';
            spinVoucherErrorMessage.classList.remove('hidden');
            hideLoading();
            return;
        }

        const now = new Date();
        const expiryTime = new Date(voucher.expiry);
        if (expiryTime <= now) {
            spinVoucherErrorMessage.textContent = 'Mã vòng quay đã hết hạn.';
            spinVoucherErrorMessage.classList.remove('hidden');
            hideLoading();
            return;
        }

        const alreadyUsed = await hasUserUsedSpinVoucher(voucherCode);
        if (alreadyUsed) {
            spinVoucherErrorMessage.textContent = 'Bạn đã sử dụng mã vòng quay này rồi.';
            spinVoucherErrorMessage.classList.remove('hidden');
            hideLoading();
            return;
        }

        // Valid and unused spin voucher! Grant spins.
        let currentSpins = await getUserSpins();
        const spinsToGrant = parseInt(voucher.value, 10);
        if (isNaN(spinsToGrant) || spinsToGrant <= 0) {
            spinVoucherErrorMessage.textContent = 'Mã vòng quay này không có giá trị lượt quay hợp lệ.';
            spinVoucherErrorMessage.classList.remove('hidden');
            hideLoading();
            return;
        }

        await setUserSpins(currentSpins + spinsToGrant);
        await markSpinVoucherAsUsed(voucherCode);

        showMessage(`Bạn đã nhận được ${spinsToGrant} lượt quay từ mã ${voucherCode}!`, 'success');
        closeModal(spinVoucherEntryModal);
        updateSpinCountUI(); // Update spin count display immediately
        
        // Now open the lucky wheel modal
        openModal(luckyWheelModal);
        if (shopDataCache.rewards.length > 0) {
            drawWheel(); // Initial draw of the wheel
        } else {
            luckyWheelMessage.textContent = 'Chưa có phần thưởng nào được cấu hình. Vui lòng liên hệ Admin.';
            luckyWheelMessage.classList.remove('hidden');
            spinButton.disabled = true;
        }

    } catch (error) {
        console.error("Error applying spin voucher:", error);
        spinVoucherErrorMessage.textContent = `Lỗi: ${error.message}`;
        spinVoucherErrorMessage.classList.remove('hidden');
    } finally {
        hideLoading();
    }
});


closeLuckyWheelModalBtn.addEventListener('click', () => {
    closeModal(luckyWheelModal);
    prizeResultDiv.classList.add('hidden');
    voucherDisplayArea.classList.add('hidden');
    itemDisplayArea.classList.add('hidden');
    luckyWheelMessage.classList.add('hidden');
    spinButton.disabled = true; // Disable until new eligibility check
    spinButton.textContent = 'QUAY NGAY!'; // Reset button text
    if (spinTimeout) {
        clearTimeout(spinTimeout);
        // Reset rotation visually without transition after modal closes
        luckyWheelCanvas.style.transition = 'none';
        luckyWheelCanvas.style.transform = 'rotate(0deg)';
        setTimeout(() => {
            luckyWheelCanvas.style.transition = ''; // Re-enable transition for next spin
        }, 50);
    }
});

luckyWheelModal.addEventListener('click', (e) => {
    if (e.target === luckyWheelModal) {
        closeModal(luckyWheelModal);
        prizeResultDiv.classList.add('hidden');
        voucherDisplayArea.classList.add('hidden');
        itemDisplayArea.classList.add('hidden');
        luckyWheelMessage.classList.add('hidden');
        spinButton.disabled = true;
        spinButton.textContent = 'QUAY NGAY!';
        if (spinTimeout) {
            clearTimeout(spinTimeout);
            luckyWheelCanvas.style.transition = 'none';
            luckyWheelCanvas.style.transform = 'rotate(0deg)';
            setTimeout(() => {
                luckyWheelCanvas.style.transition = '';
            }, 50);
        }
    }
});

spinButton.addEventListener('click', async () => {
    if (spinning) return;

    let spinsRemaining = await getUserSpins();

    if (spinsRemaining <= 0) {
        luckyWheelMessage.textContent = 'Bạn không có lượt quay nào. Vui lòng nhập mã quay hợp lệ.';
        luckyWheelMessage.classList.remove('hidden');
        spinButton.disabled = true;
        return;
    }

    if (shopDataCache.rewards.length === 0) {
        luckyWheelMessage.textContent = 'Admin chưa cấu hình phần thưởng. Vui lòng liên hệ Admin.';
        luckyWheelMessage.classList.remove('hidden');
        spinButton.disabled = true;
        return;
    }

    spinning = true;
    spinsRemaining--; // Decrement spin count BEFORE the spin starts
    await setUserSpins(spinsRemaining);
    updateSpinCountUI(); // Update UI immediately after decrementing
    spin();
});

copyVoucherBtn.addEventListener('click', () => {
    const voucherCode = wonVoucherCodeSpan.textContent;
    if (voucherCode) {
        navigator.clipboard.writeText(voucherCode).then(() => {
            showMessage('Mã voucher đã được sao chép!', 'success');
        }).catch(err => {
            console.error('Không thể sao chép văn bản:', err);
            showMessage('Không thể sao chép mã voucher. Vui lòng sao chép thủ công.', 'error');
        });
    }
});

// --- Admin Reward Management Logic ---

// Listen to the management modal opening (from script.js)
const originalOpenManagementModalFn = openManagementModalBtn.onclick;
openManagementModalBtn.onclick = async () => {
    if (originalOpenManagementModalFn) {
        originalOpenManagementModalFn(); // Call the original handler in script.js
    }
    if (loggedInUser && loggedInUser.isAdmin) {
        renderRewardsList();
        resetAddEditRewardForm();
        updateRewardFormVisibility();
    }
};

newRewardTypeSelect.addEventListener('change', updateRewardFormVisibility);

function updateRewardFormVisibility() {
    const selectedType = newRewardTypeSelect.value;
    if (selectedType === 'voucher' || selectedType === 'item' || selectedType === 'freespin') { // 'freespin' now needs a value
        rewardValueContainer.classList.remove('hidden');
        if (selectedType === 'freespin') {
            newRewardValueInput.placeholder = 'Số lượt quay';
            newRewardValueInput.type = 'number';
            newRewardValueInput.min = '1';
        } else if (selectedType === 'voucher') {
            newRewardValueInput.placeholder = 'Mã Voucher';
            newRewardValueInput.type = 'text';
            newRewardValueInput.min = ''; // Remove min attribute
        } else if (selectedType === 'item') {
            newRewardValueInput.placeholder = 'ID Sản phẩm';
            newRewardValueInput.type = 'text';
            newRewardValueInput.min = ''; // Remove min attribute
        }
    } else {
        rewardValueContainer.classList.add('hidden');
    }

    if (selectedType === 'item') {
        rewardImageContainer.classList.remove('hidden');
    } else {
        rewardImageContainer.classList.add('hidden');
    }
}

async function renderRewardsList() {
    currentRewardsList.innerHTML = '';
    if (shopDataCache.rewards.length === 0) {
        currentRewardsList.innerHTML = '<p class="text-gray-500 italic">Chưa có phần thưởng nào được cấu hình.</p>';
        return;
    }

    shopDataCache.rewards.forEach(reward => {
        const rewardDiv = document.createElement('div');
        rewardDiv.className = 'admin-reward-item';
        rewardDiv.innerHTML = `
            ${reward.image ? `<img src="${reward.image}" onerror="this.onerror=null;this.src='https://placehold.co/40x40/cccccc/333333?text=Reward';" alt="${reward.name}">` : ''}
            <div class="info">
                <p class="font-semibold text-gray-900">${reward.name} (${reward.type === 'freespin' ? 'Lượt quay' : reward.type})</p>
                <p>Giá trị: ${reward.type === 'freespin' ? `${reward.value} lượt` : (reward.value || 'N/A')}</p>
                <p>Tỷ lệ: ${reward.chance}%</p>
            </div>
            <div class="actions">
                <button class="edit-reward-btn bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-reward-id="${reward.id}">Sửa</button>
                <button class="delete-reward-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-reward-id="${reward.id}">Xóa</button>
            </div>
        `;
        currentRewardsList.appendChild(rewardDiv);
    });

    document.querySelectorAll('.edit-reward-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const rewardId = e.target.dataset.rewardId;
            editReward(rewardId);
        });
    });

    document.querySelectorAll('.delete-reward-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const rewardId = e.target.dataset.rewardId;
            if (confirm('Bạn có chắc chắn muốn xóa phần thưởng này?')) {
                await deleteReward(rewardId);
            }
        });
    });
}

function resetAddEditRewardForm() {
    editRewardIdInput.value = '';
    newRewardNameInput.value = '';
    newRewardTypeSelect.value = 'voucher';
    newRewardValueInput.value = '';
    newRewardImageInput.value = '';
    newRewardChanceInput.value = '0';
    submitRewardBtn.textContent = 'Thêm Phần Thưởng';
    cancelEditRewardBtn.classList.add('hidden');
    updateRewardFormVisibility();
}

addEditRewardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showMessage('Bạn không có quyền quản lý phần thưởng.', 'error');
        return;
    }
    showLoading();

    const rewardId = editRewardIdInput.value;
    const name = newRewardNameInput.value.trim();
    const type = newRewardTypeSelect.value;
    let value = newRewardValueInput.value.trim(); // Use let for value
    const image = newRewardImageInput.value.trim();
    const chance = parseFloat(newRewardChanceInput.value);

    if (isNaN(chance) || chance < 0 || chance > 100) {
        showMessage('Tỷ lệ trúng phải là một số từ 0 đến 100.', 'error');
        hideLoading();
        return;
    }

    if (type === 'freespin') {
        value = parseInt(value, 10); // Convert to integer for freespin count
        if (isNaN(value) || value <= 0) {
            showMessage('Số lượt quay phải là một số nguyên dương.', 'error');
            hideLoading();
            return;
        }
    } else if (type !== 'thankyou') { // For voucher and item types
        if (!value) {
            showMessage('Giá trị phần thưởng không được để trống.', 'error');
            hideLoading();
            return;
        }
    }


    const newReward = {
        name,
        type,
        value: type === 'thankyou' ? null : value, // Only freespin and other types have value
        image: type === 'item' ? image : null, // Only image for 'item'
        chance
    };

    if (rewardId) {
        const index = shopDataCache.rewards.findIndex(r => r.id === rewardId);
        if (index > -1) {
            shopDataCache.rewards[index] = { ...shopDataCache.rewards[index], ...newReward };
        }
        showMessage('Phần thưởng đã được cập nhật!', 'success');
        console.log(`Reward ${rewardId} updated.`);
    } else {
        newReward.id = generateId();
        shopDataCache.rewards.push(newReward);
        showMessage('Phần thưởng đã được thêm!', 'success');
        console.log("New reward added:", newReward);
    }
    await saveShopDataForRewards(); // Save the updated shopDataCache.rewards
    resetAddEditRewardForm();
    drawWheel(); // Redraw wheel with new rewards
    hideLoading();
});

function editReward(rewardId) {
    const reward = shopDataCache.rewards.find(r => r.id === rewardId);
    if (!reward) {
        showMessage('Không tìm thấy phần thưởng.', 'error');
        return;
    }

    editRewardIdInput.value = reward.id;
    newRewardNameInput.value = reward.name;
    newRewardTypeSelect.value = reward.type;
    newRewardValueInput.value = reward.value || '';
    newRewardImageInput.value = reward.image || '';
    newRewardChanceInput.value = reward.chance;

    submitRewardBtn.textContent = 'Lưu Thay Đổi';
    cancelEditRewardBtn.classList.remove('hidden');
    updateRewardFormVisibility();
}

cancelEditRewardBtn.addEventListener('click', resetAddEditRewardForm);

async function deleteReward(rewardId) {
    showLoading();
    try {
        shopDataCache.rewards = shopDataCache.rewards.filter(r => r.id !== rewardId);
        await saveShopDataForRewards();
        drawWheel(); // Redraw wheel after deletion
        showMessage('Phần thưởng đã được xóa!', 'success');
        console.log(`Reward ${rewardId} deleted.`);
    } catch (error) {
        console.error("Error deleting reward:", error);
        showMessage(`Lỗi khi xóa phần thưởng: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Separate save function for rewards to avoid touching other shopDataCache parts if possible.
// This assumes `shopData` document contains the `rewards` array.
async function saveShopDataForRewards() {
    showLoading();
    try {
        const shopDocRef = doc(collection(db, `artifacts/${appId}/public/data/shopSettings`), 'shopData');
        await updateDoc(shopDocRef, { rewards: shopDataCache.rewards });
        showMessage('Dữ liệu phần thưởng đã được lưu!', 'success');
        console.log("Reward data successfully saved to Firestore.");
    } catch (error) {
        console.error("Error saving reward data:", error);
        showMessage(`Lỗi lưu dữ liệu phần thưởng: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Auth listener for script2.js to know user status
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserId = user.uid;
            console.log("script2.js: User authenticated:", user.uid);
            const userProfileDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}`);
            try {
                const userDocSnap = await getDoc(userProfileDocRef);
                if (userDocSnap.exists()) {
                    loggedInUser = { id: currentUserId, ...userDocSnap.data() };
                    const shopDocSnap = await getDoc(doc(collection(db, `artifacts/${appId}/public/data/shopSettings`), 'shopData'));
                    if (shopDocSnap.exists()) {
                        const shopDataFromFirestore = shopDocSnap.data();
                        loggedInUser.isAdmin = (loggedInUser.email === shopDataFromFirestore.adminEmail);
                    } else {
                        loggedInUser.isAdmin = false;
                    }
                } else {
                    loggedInUser = { id: currentUserId, username: user.email, fullname: '', phone: '', province: '', isAdmin: false, email: user.email };
                }
            } catch (error) {
                console.error("script2.js: Error fetching user profile:", error);
            }
        } else {
            loggedInUser = { id: null, username: 'Khách', isAdmin: false, email: null, fullname: '', phone: '', province: '' };
            currentUserId = null;
        }
        updateSpinCountUI(); // Update UI when auth state changes
        updateGiftButtonState(); // Update gift button state
    });

    // Real-time listener for shopDataCache.rewards and shopDataCache.vouchers (for display)
    const shopDocRef = doc(collection(db, `artifacts/${appId}/public/data/shopSettings`), 'shopData');
    onSnapshot(shopDocRef, (shopDocSnap) => {
        if (shopDocSnap.exists()) {
            const data = shopDocSnap.data();
            shopDataCache.rewards = data.rewards || [];
            shopDataCache.vouchers = data.vouchers || {}; // Also load vouchers for display in rewards list
            shopDataCache.products = data.products || []; // Load products for item rewards
            console.log("script2.js: Shop data (rewards, vouchers, products) updated from Firestore.");
            drawWheel(); // Redraw wheel if rewards change
            renderRewardsList(); // Re-render admin reward list
            grantSpinIfEligible(); // Re-check eligibility whenever shop data changes
        } else {
            shopDataCache.rewards = [];
            shopDataCache.vouchers = {};
            shopDataCache.products = [];
            console.log("script2.js: No shop data found or initialized for rewards.");
        }
    }, (error) => console.error("script2.js: Error loading shop data with onSnapshot:", error));

    // Ensure initial state of gift button is correct
    updateGiftButtonState();
});
