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
    vouchers: {},
    rewards: [] // New: Array to store lucky wheel rewards
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
        ctx.arc(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2, luckyWheelCanvas.width / 2, angle, angle + arc);
        ctx.lineTo(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2);
        // Fill based on index for variety
        ctx.fillStyle = `hsl(${i * 60}, 70%, 70%)`;
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2);
        ctx.rotate(angle + arc / 2 + Math.PI / 2); // Rotate text to be upright
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
                ctx.save();
                ctx.translate(luckyWheelCanvas.width / 2, luckyWheelCanvas.height / 2);
                ctx.rotate(angle + arc / 2 + Math.PI / 2);
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

    drawIndicator(); // Draw the pointer
}

function drawIndicator() {
    ctx.beginPath();
    ctx.moveTo(luckyWheelCanvas.width - 15, luckyWheelCanvas.height / 2 - 10);
    ctx.lineTo(luckyWheelCanvas.width - 15, luckyWheelCanvas.height / 2 + 10);
    ctx.lineTo(luckyWheelCanvas.width, luckyWheelCanvas.height / 2);
    ctx.fillStyle = 'red';
    ctx.fill();
}

function spin() {
    spinButton.disabled = true;
    prizeResultDiv.classList.add('hidden');
    voucherDisplayArea.classList.add('hidden');
    itemDisplayArea.classList.add('hidden');
    luckyWheelMessage.classList.add('hidden');

    spinTime = 0;
    spinTimeTotal = Math.random() * 3000 + 4000; // Spin for 4-7 seconds
    spinAngleStart = Math.random() * 10 + 10; // Random initial speed
    spinDirection = Math.random() > 0.5 ? 1 : -1; // Random spin direction

    // Determine the winning segment index
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

    if (winningIndex === -1 && shopDataCache.rewards.length > 0) {
        // If no prize is won due to chances, default to "Thank you" or a random one
        // or a specific "Chúc bạn may mắn lần sau" reward if it exists.
        const thankYouIndex = shopDataCache.rewards.findIndex(r => r.type === 'thankyou');
        winningIndex = thankYouIndex !== -1 ? thankYouIndex : Math.floor(Math.random() * shopDataCache.rewards.length);
    } else if (shopDataCache.rewards.length === 0) {
        showMessage('Không có phần thưởng nào để quay.', 'error');
        spinButton.disabled = false;
        return;
    }

    // Calculate the target angle for the winning segment
    const segmentAngle = arc; // Angle of each segment
    const targetCenterAngle = (winningIndex * segmentAngle) + (segmentAngle / 2); // Center of the winning segment

    // Randomize the exact stopping point within the segment
    const randomOffset = (Math.random() * 0.8 - 0.4) * segmentAngle; // +/- 40% of segment
    let desiredAngle = targetCenterAngle + randomOffset;

    // Adjust for the pointer's position (which is at the right edge)
    // The canvas is rotated, so the "top" of the wheel (0 radians) is at 12 o'clock.
    // The pointer is at 3 o'clock (PI/2 radians).
    // So, we want the *center* of the winning segment to align with PI/2.
    // The current rotation `luckyWheelCanvas.style.transform` is what controls the wheel's visual position.
    // We need to calculate the *total* rotation required.
    const currentRotationDeg = parseFloat(luckyWheelCanvas.style.transform.replace('rotate(', '').replace('deg)', '')) || 0;
    const currentRotationRad = currentRotationDeg * Math.PI / 180;

    // The angle from the "start" of the wheel (0 degrees) to the winning segment center (relative to the wheel's current rotation)
    // is (winningIndex * arc) + (arc / 2)
    // We want the pointer (at 90 degrees/PI/2 radians) to point to this.
    // So, final stop angle should be (N*360 + 90) - (winningIndex*arc + arc/2)
    // This makes the *start* of the spinning angle irrelevant, only the final landing matters.

    // Let's simplify: we want the pointer to land on the center of the winning segment.
    // The pointer is at Math.PI / 2 (90 degrees).
    // The segments are drawn starting from 0 (3 o'clock).
    // So, to have the pointer land on segment `winningIndex`, we need the wheel to rotate such that
    // the segment's center `(winningIndex * arc + arc / 2)` aligns with `Math.PI / 2`.
    // The total rotation needed will be `(Math.PI / 2) - (winningIndex * arc + arc / 2) + N * 2 * Math.PI`.
    // We choose N large enough to make it spin multiple times.

    // Calculate the normalized angle for the winning segment (where 0 is 3 o'clock)
    const normalizedWinningAngle = (winningIndex * arc + arc / 2);

    // We want this normalizedWinningAngle to align with the pointer's position (which is at Math.PI / 2 from drawing origin).
    // So the final wheel rotation angle should be (Math.PI / 2) - normalizedWinningAngle.
    // Add many full rotations to ensure it spins a lot.
    const fullRotations = 10; // Spin at least 10 full turns
    let finalAngle = (fullRotations * 2 * Math.PI) + (Math.PI / 2 - normalizedWinningAngle) + randomOffset; // Add random offset for more natural feel

    // Make sure finalAngle is positive to prevent negative spin direction issues with transform
    while (finalAngle < 0) {
        finalAngle += (2 * Math.PI);
    }

    const startAngle = parseFloat(luckyWheelCanvas.style.transform.replace('rotate(', '').replace('deg)', '')) * Math.PI / 180 || 0;
    spinAngleStart = (finalAngle - startAngle) / spinTimeTotal; // Calculate speed needed to reach final angle


    spinTime = 0;
    rotateWheel(); // Start the animation
}


function rotateWheel() {
    spinTime += 30; // Increment by frame time (approx 30ms for 30fps)
    if (spinTime >= spinTimeTotal) {
        stopRotateWheel();
        return;
    }
    const spinAngle = spinAngleStart * (spinTimeTotal - spinTime); // Decelerating speed
    const currentRotation = parseFloat(luckyWheelCanvas.style.transform.replace('rotate(', '').replace('deg)', '')) || 0;
    const newRotation = currentRotation + (spinAngle * 180 / Math.PI * spinDirection);

    luckyWheelCanvas.style.transform = `rotate(${newRotation}deg)`;
    spinTimeout = setTimeout(rotateWheel, 30);
}

function stopRotateWheel() {
    clearTimeout(spinTimeout);
    spinning = false;

    // Get the final rotation in degrees
    const finalRotationDeg = parseFloat(luckyWheelCanvas.style.transform.replace('rotate(', '').replace('deg)', '')) % 360;
    // Normalize to 0-360 degrees
    const normalizedRotationDeg = (finalRotationDeg + 360) % 360;

    // Convert to radians (where 0 is 3 o'clock)
    const normalizedRotationRad = normalizedRotationDeg * Math.PI / 180;

    // Calculate which segment the pointer is on
    // The pointer is at 90 degrees (Math.PI / 2).
    // The segments are drawn clockwise starting from 0 degrees (3 o'clock).
    // We need to find which segment the current *pointer* position falls into on the *static* wheel.

    const numSegments = shopDataCache.rewards.length;
    if (numSegments === 0) {
        showMessage('Không có phần thưởng để xác định.', 'error');
        return;
    }
    const segmentArc = (2 * Math.PI) / numSegments;

    // The angle measured from the pointer (90 deg) clockwise to the segment start.
    // If wheel is rotated by `R` radians, a point `P` on the wheel is now at `P+R`.
    // The pointer is fixed at `PI/2`. So we're looking for `P + R = PI/2 + N*2PI`.
    // So, `P = PI/2 - R`. Normalize P to be between 0 and 2PI.
    let landingAngle = (Math.PI / 2 - normalizedRotationRad + 2 * Math.PI) % (2 * Math.PI);

    // Determine the winning segment index based on landingAngle
    let winningIndex = -1;
    for (let i = 0; i < numSegments; i++) {
        const startAngleOfSegment = (i * segmentArc);
        const endAngleOfSegment = (i * segmentArc) + segmentArc;
        if (landingAngle >= startAngleOfSegment && landingAngle < endAngleOfSegment) {
            winningIndex = i;
            break;
        }
    }

    if (winningIndex === -1) {
        // Fallback in case of floating point precision issues near boundaries
        winningIndex = Math.floor(landingAngle / segmentArc);
        if (winningIndex >= numSegments) winningIndex = numSegments - 1;
        if (winningIndex < 0) winningIndex = 0;
    }

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

    // Set user spin status to true
    try {
        const userRewardDocRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/rewardStatus`, 'spinEligibility');
        await setDoc(userRewardDocRef, { hasSpun: true, lastSpinDate: new Date().toISOString() }, { merge: true });
        console.log("User spin status updated to hasSpun: true");
    } catch (error) {
        console.error("Error updating user spin status:", error);
        showMessage(`Lỗi khi cập nhật trạng thái quay: ${error.message}`, 'error');
    }

    // Handle reward specific actions
    if (reward.type === 'voucher' && reward.value) {
        // Voucher is simply displayed. The user can copy it.
        // We don't add it to their "vouchers" collection here, as vouchers are global.
        // The user manually applies it during product purchase.
        showMessage(`Bạn đã trúng voucher: ${reward.value}!`, 'success');
    } else if (reward.type === 'item' && reward.value) {
        // Add item to user's cart
        const productId = reward.value;
        const itemQuantity = 1; // Assuming one item per spin
        const product = shopDataCache.products.find(p => p.id === productId);

        if (product) {
            // Check if userCartCache is available (from script.js)
            // If script.js's userCartCache is not directly accessible, we need to fetch it.
            // For simplicity, let's assume it's available or we refetch it.
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
                // Determine priceAtAddToCart and originalPriceForVAT for the item
                let priceAtAddToCart = product.basePrice; // Default to base price
                let originalPriceForVAT = product.basePrice;

                // If product has variants, try to find a default or first variant's pricing
                if (product.variants && product.variants.length > 0) {
                    const defaultVariant = product.variants[0]; // Or choose a specific default
                    priceAtAddToCart += (defaultVariant.priceImpact || 0);
                    originalPriceForVAT += (defaultVariant.priceImpact || 0);
                }
                // No voucher applied for prize items added to cart automatically

                userCartData.push({
                    productId: product.id,
                    productName: product.name,
                    productImage: product.image,
                    selectedColor: null, // Prize items may not have specific color/storage selected
                    selectedStorage: null,
                    priceAtAddToCart: priceAtAddToCart,
                    originalPriceForVAT: originalPriceForVAT,
                    quantity: itemQuantity
                });
            }

            try {
                await setDoc(doc(db, `artifacts/${appId}/users/${loggedInUser.id}/cart`, 'currentCart'), { items: userCartData });
                showMessage(`Sản phẩm "${product.name}" đã được thêm vào giỏ hàng của bạn!`, 'success');
                // Trigger update of cart count in script.js's UI if possible, or reload needed data
                // For now, assuming script.js updates on its own on `onSnapshot`
            } catch (error) {
                console.error("Error adding item to cart from reward:", error);
                showMessage(`Lỗi khi thêm sản phẩm "${product.name}" vào giỏ hàng.`, 'error');
            }
        } else {
            showMessage(`Không tìm thấy thông tin sản phẩm cho phần thưởng: ${reward.name}`, 'error');
        }
    } else if (reward.type === 'freespin') {
        // Give another spin
        let currentSpins = await getUserSpins();
        currentSpins++;
        await setUserSpins(currentSpins);
        showMessage('Chúc mừng! Bạn đã nhận được một lượt quay miễn phí!', 'success');
        updateSpinCountUI();
        spinButton.disabled = false; // Enable spin button again
        giftButton.classList.remove('disabled'); // Enable gift button again
    } else if (reward.type === 'thankyou') {
        showMessage('Chúc bạn may mắn lần sau!', 'info');
    }
}

// --- User Spin Eligibility & Count ---
async function getUserSpins() {
    if (!loggedInUser || !loggedInUser.id) {
        return 0; // No spins for logged out users
    }
    try {
        const userRewardDocRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/rewardStatus`, 'spinEligibility');
        const docSnap = await getDoc(userRewardDocRef);
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
        const userRewardDocRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/rewardStatus`, 'spinEligibility');
        await setDoc(userRewardDocRef, { spins: count }, { merge: true });
        console.log(`User ${loggedInUser.id} spins set to ${count}`);
    } catch (error) {
        console.error("Error setting user spins:", error);
    }
}

async function hasUserSpunForCurrentOrder() {
    if (!loggedInUser || !loggedInUser.id) {
        return true; // No orders, no spins
    }
    try {
        const userRewardDocRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/rewardStatus`, 'spinEligibility');
        const docSnap = await getDoc(userRewardDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.hasSpun || false; // Default to false if not set
        }
        return false;
    } catch (error) {
        console.error("Error checking user spin status:", error);
        return true; // Assume true to prevent unlimited spins on error
    }
}

async function grantSpinIfEligible() {
    if (!loggedInUser || !loggedInUser.id) {
        return;
    }

    try {
        const shippingOrdersQuery = query(
            collection(db, `artifacts/${appId}/users/${loggedInUser.id}/orders`),
            where('status', '==', 'shipping')
        );
        const shippingOrdersSnap = await getDocs(shippingOrdersQuery);

        const userRewardDocRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/rewardStatus`, 'spinEligibility');
        const userRewardSnap = await getDoc(userRewardDocRef);
        const userData = userRewardSnap.exists() ? userRewardSnap.data() : { hasSpun: false, lastSpinOrderId: null, spins: 0 };

        let eligibleForSpin = false;
        let mostRecentShippingOrderId = null;

        if (!shippingOrdersSnap.empty) {
            // Find the most recent shipping order
            const sortedShippingOrders = shippingOrdersSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

            mostRecentShippingOrderId = sortedShippingOrders[0].id;

            // If the user has a shipping order and hasn't spun for this specific order ID yet
            if (userData.lastSpinOrderId !== mostRecentShippingOrderId) {
                eligibleForSpin = true;
            } else if (userData.spins > 0) {
                // If they have existing spins from previous grants (e.g., from a freespin reward)
                eligibleForSpin = true;
            }
        }

        if (eligibleForSpin && userData.spins === 0) { // Only grant if no existing spins
            await setUserSpins(1);
            await setDoc(userRewardDocRef, {
                hasSpun: false, // Reset hasSpun when a new eligible order is found
                lastSpinOrderId: mostRecentShippingOrderId,
                spins: 1
            }, { merge: true });
            console.log("Granted 1 spin due to new shipping order.");
        } else if (!eligibleForSpin && userData.spins > 0 && userData.lastSpinOrderId === mostRecentShippingOrderId) {
             // If user has spins but no new eligible order, don't remove existing spins.
             // This covers cases where freespin grants keep spins > 0
             console.log("User has existing spins or no new eligible order, no new spin granted.");
        } else if (!eligibleForSpin && userData.spins === 0) {
             // No eligible shipping order and no existing spins, disable button
             console.log("No eligible shipping order, no new spin granted.");
             await setUserSpins(0); // Ensure spins are 0 if not eligible
             await setDoc(userRewardDocRef, { hasSpun: false, lastSpinOrderId: null, spins: 0 }, { merge: true }); // Reset
        }
        updateSpinCountUI();
        updateGiftButtonState();

    } catch (error) {
        console.error("Error granting spin eligibility:", error);
        showMessage(`Lỗi khi kiểm tra lượt quay: ${error.message}`, 'error');
    }
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
            luckyWheelMessage.textContent = 'Bạn không có lượt quay nào. Vui lòng tạo đơn hàng mới để nhận lượt quay.';
            luckyWheelMessage.classList.remove('hidden');
        }
    });
}

function updateGiftButtonState() {
    getUserSpins().then(spins => {
        if (spins > 0) {
            giftButton.classList.remove('disabled');
        } else {
            giftButton.classList.add('disabled');
        }
    });
}

// --- Event Listeners ---
giftButton.addEventListener('click', async () => {
    if (!loggedInUser || !loggedInUser.id) {
        showMessage('Vui lòng đăng nhập để tham gia vòng quay may mắn.', 'info');
        // This assumes openModal exists in the global scope or script.js
        document.getElementById('login-register-modal').classList.remove('hidden'); // Directly open login modal
        document.getElementById('login-register-modal').classList.add('active');
        return;
    }
    // Check if user has shipping orders and hasn't spun yet
    await grantSpinIfEligible(); // Check eligibility and grant spin if needed
    updateSpinCountUI(); // Update UI immediately after grant check

    openModal(luckyWheelModal);
    if (shopDataCache.rewards.length > 0) {
        drawWheel(); // Initial draw of the wheel
    } else {
        luckyWheelMessage.textContent = 'Chưa có phần thưởng nào được cấu hình. Vui lòng liên hệ Admin.';
        luckyWheelMessage.classList.remove('hidden');
        spinButton.disabled = true;
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
        luckyWheelCanvas.style.transform = 'rotate(0deg)'; // Reset wheel rotation
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
            luckyWheelCanvas.style.transform = 'rotate(0deg)';
        }
    }
});

spinButton.addEventListener('click', async () => {
    if (spinning) return;

    let spinsRemaining = await getUserSpins();

    if (spinsRemaining <= 0) {
        luckyWheelMessage.textContent = 'Bạn không có lượt quay nào. Vui lòng tạo đơn hàng mới để nhận lượt quay.';
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
    spinsRemaining--;
    await setUserSpins(spinsRemaining);
    updateSpinCountUI();
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
// This is a bit of a workaround since script.js controls the modal,
// but it works for modularity without deeply coupling.
// A better long-term solution might involve a global event bus or passing functions.
const originalOpenManagementModalFn = openManagementModalBtn.onclick;
openManagementModalBtn.onclick = async () => {
    if (originalOpenManagementModalFn) {
        originalOpenManagementModalFn(); // Call the original handler in script.js
    }
    // Only render rewards list if user is admin
    if (loggedInUser && loggedInUser.isAdmin) {
        renderRewardsList();
        resetAddEditRewardForm(); // Reset form when modal opens
        updateRewardFormVisibility(); // Initial visibility check for reward value/image inputs
    }
};

newRewardTypeSelect.addEventListener('change', updateRewardFormVisibility);

function updateRewardFormVisibility() {
    const selectedType = newRewardTypeSelect.value;
    if (selectedType === 'voucher' || selectedType === 'item') {
        rewardValueContainer.classList.remove('hidden');
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
                <p class="font-semibold text-gray-900">${reward.name} (${reward.type})</p>
                <p>Giá trị: ${reward.value || 'N/A'}</p>
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
    const value = newRewardValueInput.value.trim();
    const image = newRewardImageInput.value.trim();
    const chance = parseFloat(newRewardChanceInput.value);

    if (isNaN(chance) || chance < 0 || chance > 100) {
        showMessage('Tỷ lệ trúng phải là một số từ 0 đến 100.', 'error');
        hideLoading();
        return;
    }

    const newReward = {
        name,
        type,
        value: type === 'thankyou' || type === 'freespin' ? null : value, // No value for 'thankyou' or 'freespin'
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
    // Re-initialize firebase app if not already done by script.js
    // This assumes `initializeApp`, `getAuth`, `getFirestore` are defined in the global scope
    // or loaded via modules as here.

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
                    // We need shopDataCache.adminEmail, which should be loaded by script.js
                    // For now, assume it's available or fetch it if crucial.
                    // Or make shopDataCache a global in script.js to be shared.
                    // For now, let's fetch shopDataCache.adminEmail for isAdmin check.
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
