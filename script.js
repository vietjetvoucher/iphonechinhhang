import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment
// __app_id: The unique ID for the current application instance.
// __firebase_config: Firebase configuration object (JSON string) for initializing the app.
// __initial_auth_token: Custom Firebase authentication token for initial sign-in.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    // User's provided Firebase configuration for local testing
    apiKey: "AIzaSyBPjpG1V3HpR4wCFEXth1byWN0q9-9jWiM",
    authDomain: "hhmobile-df259.firebaseapp.com",
    projectId: "hhmobile-df259",
    storageBucket: "hhmobile-df259.firebaseapp.com",
    messagingSenderId: "273294651647",
    appId: "1:273294651647:web:02bcd7be6f760cd6849cca",
    measurementId: "G-YSJ062B717"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let loggedInUser = null;
let currentUserId = null;
const DEFAULT_WAREHOUSE_ADDRESS = "194 Đ. Lê Duẩn, Khâm Thiên, Đống Đa, Hà Nội";

let shopDataCache = {
    products: [],
    vouchers: {}, // Voucher structure will be updated to include expiry
    warrantyPackages: [],
    bankDetails: {},
    advertisement: {},
    shippingUnit: {},
    name: 'Thegioididong.com',
    address: 'Chưa cập nhật',
    backgroundImg: '',
    adminEmail: 'dimensiongsv@gmail.com' // Default admin email
};
let userOrdersCache = [];
let userCartCache = [];

// Chat related global variables
const CHAT_COLLECTION_PATH = `artifacts/${appId}/public/data/chats`;
let currentOpenChatId = null; // Stores the ID of the chat currently open in the modal
let chatUnsubscribe = null; // To unsubscribe from real-time chat listeners
let chatListUnsubscribe = null; // To unsubscribe from admin chat list listener

const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingIndicator';
loadingOverlay.className = 'loading-overlay hidden';
loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
document.body.appendChild(loadingOverlay);

const notificationsContainer = document.getElementById('notifications-container');

function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

/**
 * Hiển thị một cửa sổ thông báo nhỏ với icon.
 * @param {string} message Nội dung thông báo.
 * @param {'info'|'success'|'error'} type Loại thông báo để định kiểu (màu sắc).
 * @param {string} [iconClass] Lớp CSS của icon Font Awesome (ví dụ: 'fas fa-info-circle').
 */
function showNotification(message, type = 'info', iconClass = '') {
    const notificationItem = document.createElement('div');
    notificationItem.className = `notification-item ${type}`;
    if (!iconClass) {
        switch (type) {
            case 'success':
                iconClass = 'fas fa-check-circle';
                break;
            case 'error':
                iconClass = 'fas fa-times-circle';
                break;
            case 'info':
            default:
                iconClass = 'fas fa-info-circle';
                break;
        }
    }
    notificationItem.innerHTML = `
        <div class="icon"><i class="${iconClass}"></i></div>
        <div class="message-text">${message}</div>
    `;
    notificationsContainer.appendChild(notificationItem);

    // Force reflow to enable transition
    void notificationItem.offsetWidth;
    notificationItem.classList.add('show');

    setTimeout(() => {
        notificationItem.classList.remove('show');
        notificationItem.addEventListener('transitionend', () => {
            notificationItem.remove();
        }, { once: true });
    }, 3000);
}


const shopNameDisplay = document.getElementById('shop-name-display');
const shopAddressDisplay = document.getElementById('shop-address-display');
const pageTitle = document.getElementById('page-title');
const bodyElement = document.body;
const advertisementBannerContainer = document.getElementById('advertisement-banner-container');
const advertisementContent = document.getElementById('advertisement-content');
const headerProductSearchInput = document.getElementById('header-product-search-input');

const productDetailModal = document.getElementById('product-detail-modal');
const orderCreationModal = document.getElementById('order-creation-modal');
const editShippingOrderModal = document.getElementById('edit-shipping-order-modal');
const shopManagementModal = document.getElementById('shop-management-modal');
const shopSettingsModal = document.getElementById('shop-settings-modal');
const shopAnalyticsModal = document.getElementById('shop-analytics-modal');
const cartModal = document.getElementById('cart-modal');
const paymentVATModal = document.getElementById('payment-vat-modal');
const orderTrackingModal = document.getElementById('order-tracking-modal');
const paymentWarrantyModal = document.getElementById('payment-warranty-modal');

const closeProductModalBtn = document.getElementById('close-product-modal');
const closeOrderModalBtn = document.getElementById('close-order-modal');
const closeEditShippingModalBtn = document.getElementById('close-edit-shipping-modal');
const closeManagementModalBtn = document.getElementById('close-management-modal');
const closeSettingsModalBtn = document.getElementById('close-settings-modal');
const closeAnalyticsModalBtn = document.getElementById('close-analytics-modal');
const closeCartModalBtn = document.getElementById('close-cart-modal');
const closePaymentVATModalBtn = document.getElementById('close-payment-vat-modal');
const closeOrderTrackingModalBtn = document.getElementById('close-order-tracking-modal');
const closePaymentWarrantyModalBtn = document.getElementById('close-payment-warranty-modal');
const closeLoginRegisterModalBtn = document.getElementById('close-login-register-modal');
const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');

const showProductsBtn = document.getElementById('show-products-btn');
const showCreatedOrdersBtn = document.getElementById('show-created-orders-btn');
const showShippingOrdersBtn = document.getElementById('show-shipping-orders-btn');
const showDeliveredOrdersBtn = document.getElementById('show-delivered-orders-btn');
const openManagementModalBtn = document.getElementById('open-management-modal-btn');
const openSettingsModalBtn = document.getElementById('open-settings-modal-btn');
const openShopAnalyticsModalBtn = document.getElementById('open-shop-analytics-modal-btn');
const openCartModalBtn = document.getElementById('open-cart-modal-btn');
const loginStatusBtn = document.getElementById('login-status-btn');
const openProfileModalBtn = document.getElementById('open-profile-modal-btn');

const productListSection = document.getElementById('product-list-section');
const createdOrdersSection = document.getElementById('created-orders-section');
const shippingOrdersSection = document.getElementById('shipping-orders-section');
const deliveredOrdersSection = document.getElementById('delivered-orders-section');

const allTabButtons = document.querySelectorAll('.tab-button');
const allSections = document.querySelectorAll('section > div');

const modalProductName = document.getElementById('modal-product-name');
const modalProductImage = document.getElementById('modal-product-image');
const modalProductBasePrice = document.getElementById('modal-product-base-price');
const modalProductPriceDisplay = document.getElementById('modal-product-price-display');
const modalProductVATDisplay = document.getElementById('modal-product-vat-display');
const modalProductDiscountDisplay = document.getElementById('modal-product-discount-display');
const modalProductSold = document.getElementById('modal-product-sold');
const modalProductRemaining = document.getElementById('modal-product-remaining');
const modalProductDescription = document.getElementById('modal-product-description');
const modalShippingCostDisplay = document.getElementById('modal-shipping-cost-display');
const productOptionsContainer = document.getElementById('product-options');
const voucherCodeInput = document.getElementById('voucher-code');
const applyVoucherBtn = document.getElementById('apply-voucher-btn');
const buyNowDetailBtn = document.getElementById('buy-now-detail-btn');
const addToCartDetailBtn = document.getElementById('add-to-cart-detail-btn');
const voucherExpiryMessage = document.getElementById('voucher-expiry-message');

const orderIdDisplay = document.getElementById('order-id-display');
const orderProductsSummary = document.getElementById('order-products-summary');
const customerNameInput = document.getElementById('customer-name');
const customerPhoneInput = document.getElementById('customer-phone');
const customerAddressInput = document.getElementById('customer-address');
const orderLocationInput = document.getElementById('order-location');
const estimatedDeliveryDateInput = document.getElementById('estimated-delivery-date');
const orderForm = document.getElementById('order-form');
const orderStatusSteps = document.querySelectorAll('.order-status-step');
const viewOnMapBtn = document.getElementById('view-on-map-btn');

const editShippingOrderIdDisplay = document.getElementById('edit-shipping-order-id-display');
const editShippingOrderHiddenId = document.getElementById('edit-shipping-order-hidden-id');
const editOrderLocationInput = document.getElementById('edit-order-location');
const editEstimatedDeliveryDateInput = document.getElementById('edit-estimated-delivery-date');
const editShippingOrderForm = document.getElementById('edit-shipping-order-form');

const cartCountSpan = document.getElementById('cart-count');
const searchCartItemsInput = document.getElementById('search-cart-items');
const clearSearchCartItemsBtn = document.getElementById('clear-search-cart-items');
const cartItemsList = document.getElementById('cart-items-list');
const cartTotalAmountSpan = document.getElementById('cart-total-amount');
const buyAllCartBtn = document.getElementById('buy-all-cart-btn');

const productManagementList = document.getElementById('product-management-list');
const addEditProductTitle = document.getElementById('add-edit-product-title');
const addEditProductForm = document.getElementById('add-edit-product-form');
const editProductIdInput = document.getElementById('edit-product-id');
const newProductNameInput = document.getElementById('new-product-name');
const newProductBasePriceInput = document.getElementById('new-product-base-price');
const newProductImageInput = document.getElementById('new-product-image');
const newProductDescriptionInput = document.getElementById('new-product-description');
const newProductReviewsInput = document.getElementById('new-product-reviews');
const newProductCategoryInput = document.getElementById('new-product-category'); // New: Category input
const colorOptionsContainer = document.getElementById('color-options-container');
const addColorOptionBtn = document.getElementById('add-color-option-btn');
const storageOptionsContainer = document.getElementById('storage-options-container');
const addStorageOptionBtn = document.getElementById('add-storage-option-btn');
const variantsContainer = document.getElementById('variants-container');
const addVariantBtn = document.getElementById('add-variant-btn');
const submitProductBtn = document.getElementById('submit-product-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

const addVoucherForm = document.getElementById('add-voucher-form');
const newVoucherCodeInput = document.getElementById('new-voucher-code');
const newVoucherQuantityInput = document.getElementById('new-voucher-quantity');
const newVoucherCodeLengthInput = document.getElementById('new-voucher-code-length');
const newVoucherValueInput = document.getElementById('new-voucher-value');
const newVoucherExpiryInput = document.getElementById('new-voucher-expiry');
const currentVouchersList = document.getElementById('current-vouchers-list');

const addAdminVoucherForm = document.getElementById('add-admin-voucher-form');
const newAdminVoucherCodeInput = document.getElementById('new-admin-voucher-code');
const newAdminVoucherQuantityInput = document.getElementById('new-admin-voucher-quantity');
const newAdminVoucherCodeLengthInput = document.getElementById('new-admin-voucher-code-length');
const newAdminVoucherValueInput = document.getElementById('new-admin-voucher-value');
const newAdminVoucherExpiryInput = document.getElementById('new-admin-voucher-expiry');


const addEditWarrantyPackageForm = document.getElementById('add-edit-warranty-package-form');
const editWarrantyPackageIdInput = document.getElementById('edit-warranty-package-id');
const newWarrantyPackageNameInput = document.getElementById('new-warranty-package-name');
const newWarrantyPackagePriceInput = document.getElementById('new-warranty-package-price');
const newWarrantyPackageDiscountInput = document.getElementById('new-warranty-package-discount');
const submitWarrantyPackageBtn = document.getElementById('submit-warranty-package-btn');
const cancelEditWarrantyPackageBtn = document.getElementById('cancel-edit-warranty-package-btn');
const currentWarrantyPackagesList = document.getElementById('current-warranty-packages-list');

const shopSettingsForm = document.getElementById('shop-settings-form');
const shopNameInput = document.getElementById('shop-name-input');
const shopAddressInput = document.getElementById('shop-address-input');
const backgroundImageURLInput = document.getElementById('background-image-url');
const advertisementTextInput = document.getElementById('advertisement-text-input');
const advertisementAnimationSelect = document.getElementById('advertisement-animation-select');
const bankNameInput = document.getElementById('bank-name-input');
const accountNumberInput = document.getElementById('account-number-input');
const accountHolderInput = document.getElementById('account-holder-input');
const qrCodeImageURLInput = document.getElementById('qr-code-image-url-input');
const uploadQrCodeBtn = document.getElementById('upload-qr-code-btn');
const shippingUnitNameInput = document.getElementById('shipping-unit-name-input');
const shippingUnitImageURLInput = document.getElementById('shipping-unit-image-url-input');
const uploadShippingUnitImageBtn = document.getElementById('upload-shipping-unit-image-btn');
const adminEmailInput = document.getElementById('admin-email-input');

const reportStartDateInput = document.getElementById('report-start-date');
const reportEndDateInput = document.getElementById('report-end-date');
const generateReportBtn = document.getElementById('generate-report-btn');
const totalRevenueDisplay = document.getElementById('total-revenue-display');
const totalOrdersDisplay = document.getElementById('total-orders-display');
const topSellingProductsList = document.getElementById('top-selling-products-list');

const qrCodeDisplay = document.getElementById('qr-code-display');
const bankNameDisplay = document.getElementById('bank-name-display');
const accountNumberDisplay = document.getElementById('account-number-display');
const accountHolderDisplay = document.getElementById('account-holder-display');
const vatBaseAmountDisplay = document.getElementById('vat-base-amount');
const totalVatOriginalDisplay = document.getElementById('total-vat-original-display');
const shopSupportVatDisplay = document.getElementById('shop-support-vat-display');
const paymentModalVATTotal = document.getElementById('payment-modal-vat-total');
const paymentAmountInput = document.getElementById('payment-amount-input');
const amountPaidDisplay = document.getElementById('amount-paid-display');
const remainingPaymentDisplay = document.getElementById('remaining-payment-display');
const confirmPaymentBtn = document.getElementById('confirm-payment-btn');
const adminConfirmVatPaymentBtn = document.getElementById('admin-confirm-vat-payment-btn');

const trackingShippingUnitImage = document.getElementById('tracking-shipping-unit-image');
const trackingShippingUnitName = document.getElementById('tracking-shipping-unit-name');
const trackingOrderId = document.getElementById('tracking-order-id');
const trackingProductDetails = document.getElementById('tracking-product-details');
const trackingCurrentLocation = document.getElementById('tracking-current-location');
const trackingDestination = document.getElementById('tracking-destination');
const checkRouteBtn = document.getElementById('check-route-btn');

const warrantyPackagesSelection = document.getElementById('warranty-packages-selection');
const qrCodeDisplayWarranty = document.getElementById('qr-code-display-warranty');
const bankNameDisplayWarranty = document.getElementById('bank-name-display-warranty');
const accountNumberDisplayWarranty = document.getElementById('account-number-display-warranty');
const accountHolderDisplayWarranty = document.getElementById('account-holder-display-warranty');
const warrantyPaymentTotal = document.getElementById('warranty-payment-total');
const confirmWarrantyPaymentBtn = document.getElementById('confirm-warranty-payment-btn');
const adminConfirmWarrantyBtn = document.getElementById('admin-confirm-warranty-btn');

const loginRegisterModal = document.getElementById('login-register-modal');
const authModalTitle = document.getElementById('auth-modal-title');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterFormLink = document.getElementById('show-register-form-link');
const showLoginFormLink = document.getElementById('show-login-form-link');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginErrorMessage = document.getElementById('login-error-message');
const registerUsernameInput = document.getElementById('register-username');
const registerPasswordInput = document.getElementById('register-password');
const registerConfirmPasswordInput = document.getElementById('register-confirm-password');
const registerFullnameInput = document.getElementById('register-fullname');
const registerPhoneInput = document.getElementById('register-phone');
const registerProvinceInput = document.getElementById('register-province');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const registerErrorMessage = document.getElementById('register-error-message');

const profileModal = document.getElementById('profile-modal');
const profileUsernameInput = document.getElementById('profile-username');
const profileFullnameInput = document.getElementById('profile-fullname');
const profilePhoneInput = document.getElementById('profile-phone');
const profileProvinceInput = document.getElementById('profile-province');
const saveProfileBtn = document.getElementById('save-profile-btn');
const profileErrorMessage = document.getElementById('profile-error-message');

const searchCreatedOrdersInput = document.getElementById('search-created-orders');
const clearSearchCreatedOrdersBtn = document.getElementById('clear-search-created-orders');
const searchShippingOrdersInput = document.getElementById('search-shipping-orders');
const clearSearchShippingOrdersBtn = document.getElementById('clear-search-shipping-orders');
const searchDeliveredOrdersInput = document.getElementById('search-delivered-orders');
const clearSearchDeliveredOrdersBtn = document.getElementById('clear-search-delivered-btn');

// Chat elements
const chatFloatBtn = document.getElementById('chat-float-btn');
const chatUnreadCountSpan = document.getElementById('chat-unread-count');
const chatModal = document.getElementById('chat-modal');
const closeChatModal = document.getElementById('close-chat-modal');
const chatModalTitle = document.getElementById('chat-modal-title');
const adminChatListContainer = document.getElementById('admin-chat-list-view');
const chatListContainer = document.getElementById('chat-list-container');
const chatMessagesArea = document.getElementById('chat-messages-view');
const chatMessagesDiv = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');
const backToChatListBtn = document.getElementById('back-to-chat-list-btn');


let currentSelectedProduct = null;
let currentSelectedOptions = {};
let currentCalculatedPrice = 0;
let currentAppliedVoucher = null;
let productsToOrder = [];
let currentOrderForPayment = null;
let isBuyNowFlow = false;
let currentOrderForTracking = null;
let currentOrderForWarranty = null;
let selectedWarrantyPackage = null;
let currentPriceBeforeVoucherAndVAT = 0;
let voucherCountdownInterval = null;

const shippingZones = {
    'mienBac': { cost: 0, provinces: ['Hà Nội', 'Hải Phòng', 'Quảng Ninh', 'Bắc Ninh', 'Hải Dương', 'Hưng Yên', 'Vĩnh Phúc', 'Thái Nguyên', 'Phú Thọ', 'Bắc Giang', 'Lạng Sơn', 'Cao Bằng', 'Hà Giang', 'Tuyên Quang', 'Lai Châu', 'Điện Biên', 'Sơn La', 'Hòa Bình', 'Yên Bái', 'Lào Cai'] },
    'mienTrung': { cost: 0, provinces: ['Đà Nẵng', 'Thừa Thiên Huế', 'Quảng Nam', 'Quảng Ngãi', 'Bình Định', 'Phú Yên', 'Khánh Hòa', 'Ninh Thuận', 'Bình Thuận', 'Kon Tum', 'Gia Lai', 'Đắk Lắk', 'Đắk Nông', 'Lâm Đồng', 'Thanh Hóa', 'Nghệ An', 'Hà Tĩnh', 'Quảng Bình', 'Quảng Trị'] },
    'mienNam': { cost: 0, provinces: ['TP. Hồ Chí Minh', 'Cần Thơ', 'Bình Dương', 'Đồng Nai', 'Bà Rịa - Vũng Tàu', 'Long An', 'Tiền Giang', 'Bến Tre', 'Trà Vinh', 'Vĩnh Long', 'Đồng Tháp', 'An Giang', 'Kiên Giang', 'Hậu Giang', 'Sóc Trăng', 'Bạc Liêu', 'Cà Mau'] },
    'default': { cost: 0 }
};

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Generates a random alphanumeric string for voucher codes.
 * @param {number} length The desired length of the voucher code.
 * @returns {string} The generated voucher code.
 */
function generateRandomVoucherCode(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

/**
 * Generates a unique voucher code that does not exist in the current shopDataCache.vouchers.
 * @param {number} length The desired length of the voucher code.
 * @returns {string} A unique voucher code.
 */
function generateUniqueVoucherCode(length) {
    let code;
    do {
        code = generateRandomVoucherCode(length);
    } while (shopDataCache.vouchers[code]); // Keep generating until a unique code is found
    return code;
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

function showSection(sectionId, clickedButton) {
    allSections.forEach(section => section.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    allTabButtons.forEach(btn => btn.classList.remove('active'));
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

async function loadShopData() {
    showLoading();
    try {
        const shopDocRef = doc(collection(db, `artifacts/${appId}/public/data/shopSettings`), 'shopData');

        onSnapshot(shopDocRef, async (shopDocSnap) => {
            if (shopDocSnap.exists()) {
                shopDataCache = { ...shopDataCache, ...shopDocSnap.data() };
                console.log("Shop data loaded from Firestore (real-time):", shopDataCache);
            } else {
                console.log("No shop data found in Firestore. Initializing with default data.");
                await setDoc(shopDocRef, shopDataCache);
                console.log("Default shop data saved to Firestore.");
            }

            loadShopSettingsToUI();
            renderProducts(); // Initial render of products
            renderProductManagementList();
            renderVouchersList();
            renderWarrantyPackagesList();
            hideLoading();
        }, (error) => {
            console.error("Error loading shop data with onSnapshot:", error);
            showNotification(`Lỗi tải dữ liệu cửa hàng: ${error.message}`, 'error');
            hideLoading();
        });

    } catch (error) {
        console.error("Error setting up shop data listener:", error);
        showNotification(`Lỗi thiết lập lắng nghe dữ liệu cửa hàng: ${error.message}`, 'error');
        hideLoading();
    }
}

async function saveShopData() {
    showLoading();
    try {
        await setDoc(doc(collection(db, `artifacts/${appId}/public/data/shopSettings`), 'shopData'), shopDataCache);
        showNotification('Dữ liệu cửa hàng đã được lưu!', 'success');
        console.log("Shop data successfully saved to Firestore.");
    } catch (error) {
        console.error("Error saving shop data:", error);
        showNotification(`Lỗi lưu dữ liệu cửa hàng: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function loadShopSettingsToUI() {
    shopNameDisplay.innerHTML = `<i class="fas fa-mobile-alt mr-2 text-gray-700"></i><span class="text-gray-900">${shopDataCache.name.replace('.com', '')}</span><span class="text-red-600">.com</span>`;
    pageTitle.textContent = shopDataCache.name;
    shopAddressDisplay.textContent = shopDataCache.address;

    if (shopDataCache.backgroundImg) {
        bodyElement.style.backgroundImage = `url('${shopDataCache.backgroundImg}')`;
    } else {
        bodyElement.style.backgroundImage = 'none';
        bodyElement.style.backgroundColor = '#fdf8f4';
    }

    shopNameInput.value = shopDataCache.name || '';
    shopAddressInput.value = shopDataCache.address || '';
    backgroundImageURLInput.value = shopDataCache.backgroundImg || '';
    advertisementTextInput.value = shopDataCache.advertisement.text || '';
    advertisementAnimationSelect.value = shopDataCache.advertisement.animation || 'none';
    bankNameInput.value = shopDataCache.bankDetails.bankName || '';
    accountNumberInput.value = shopDataCache.bankDetails.accountNumber || '';
    accountHolderInput.value = shopDataCache.bankDetails.accountHolder || '';
    qrCodeImageURLInput.value = shopDataCache.bankDetails.qrCodeImage || '';
    shippingUnitNameInput.value = shopDataCache.shippingUnit.name || 'GHN Express';
    shippingUnitImageURLInput.value = shopDataCache.shippingUnit.image || '';
    if (adminEmailInput) {
        adminEmailInput.value = shopDataCache.adminEmail || '';
    }

    updateAdvertisementBanner();
}

function updateAdvertisementBanner() {
    const adText = shopDataCache.advertisement.text;
    const adAnimation = shopDataCache.advertisement.animation;
    if (adText) {
        advertisementContent.textContent = adText;
        advertisementBannerContainer.classList.remove('hidden');
        advertisementBannerContainer.classList.remove('marquee', 'flicker');
        if (adAnimation === 'marquee') {
            advertisementBannerContainer.classList.add('marquee');
        } else if (adAnimation === 'flicker') {
            advertisementBannerContainer.classList.add('flicker');
        }
    } else {
        advertisementBannerContainer.classList.add('hidden');
        advertisementContent.textContent = '';
    }
}

shopSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Chờ admin kiểm duyệt', 'info');
        return;
    }
    showLoading();
    shopDataCache.name = shopNameInput.value.trim();
    shopDataCache.address = shopAddressInput.value.trim();
    shopDataCache.backgroundImg = backgroundImageURLInput.value.trim();
    shopDataCache.advertisement.text = advertisementTextInput.value.trim();
    shopDataCache.advertisement.animation = advertisementAnimationSelect.value;
    shopDataCache.bankDetails.bankName = bankNameInput.value.trim();
    shopDataCache.bankDetails.accountNumber = accountNumberInput.value.trim();
    shopDataCache.bankDetails.accountHolder = accountHolderInput.value.trim();
    shopDataCache.bankDetails.qrCodeImage = qrCodeImageURLInput ? qrCodeImageURLInput.value.trim() : '';
    shopDataCache.shippingUnit.name = shippingUnitNameInput ? shippingUnitNameInput.value.trim() : '';
    shopDataCache.shippingUnit.image = shippingUnitImageURLInput ? shippingUnitImageURLInput.value.trim() : '';
    shopDataCache.adminEmail = adminEmailInput ? adminEmailInput.value.trim() : '';
    await saveShopData();
    loadShopSettingsToUI();
    hideLoading();
    closeModal(shopSettingsModal);
});

document.getElementById('upload-main-image-btn').addEventListener('click', () => {
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Chờ admin kiểm duyệt', 'info');
        return;
    }
    const imageUrl = prompt('Nhập URL hình ảnh sản phẩm (URL trực tiếp, GitHub Raw, hoặc chuỗi Base64):');
    if (imageUrl) {
        newProductImageInput.value = imageUrl;
    }
});
document.getElementById('upload-background-btn').addEventListener('click', () => {
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Chờ admin kiểm duyệt', 'info');
        return;
    }
    const imageUrl = prompt('Nhập URL hình ảnh nền (URL trực tiếp, GitHub Raw, hoặc chuỗi Base64):');
    if (imageUrl) {
        backgroundImageURLInput.value = imageUrl;
    }
});
uploadQrCodeBtn.addEventListener('click', () => {
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Chờ admin kiểm duyệt', 'info');
        return;
    }
    const imageUrl = prompt('Nhập URL hình ảnh QR Code ngân hàng (URL trực tiếp, GitHub Raw, hoặc chuỗi Base64):');
    if (imageUrl) {
        qrCodeImageURLInput.value = imageUrl;
    }
});
uploadShippingUnitImageBtn.addEventListener('click', () => {
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Chờ admin kiểm duyệt', 'info');
        return;
    }
    const imageUrl = prompt('Nhập URL hình ảnh đơn vị vận chuyển (URL trực tiếp, GitHub Raw, hoặc chuỗi Base64):');
    if (imageUrl) {
        shippingUnitImageURLInput.value = imageUrl;
    }
});

closeProductModalBtn.addEventListener('click', () => {
    closeModal(productDetailModal);
    if (voucherCountdownInterval) {
        clearInterval(voucherCountdownInterval);
        voucherCountdownInterval = null;
    }
});
closeOrderModalBtn.addEventListener('click', () => closeModal(orderCreationModal));
closeEditShippingModalBtn.addEventListener('click', () => closeModal(editShippingOrderModal));
closeManagementModalBtn.addEventListener('click', () => closeModal(shopManagementModal));
closeSettingsModalBtn.addEventListener('click', () => closeModal(shopSettingsModal));
closeAnalyticsModalBtn.addEventListener('click', () => closeModal(shopAnalyticsModal));
closeCartModalBtn.addEventListener('click', () => closeModal(cartModal));
closePaymentVATModalBtn.addEventListener('click', () => closeModal(paymentVATModal));
closeOrderTrackingModalBtn.addEventListener('click', () => closeModal(orderTrackingModal));
closePaymentWarrantyModalBtn.addEventListener('click', () => closeModal(paymentWarrantyModal));
closeLoginRegisterModalBtn.addEventListener('click', () => closeModal(loginRegisterModal));
closeProfileModalBtn.addEventListener('click', () => closeModal(profileModal));
closeChatModal.addEventListener('click', () => closeModal(chatModal)); // Close chat modal

productDetailModal.addEventListener('click', (e) => {
    if (e.target === productDetailModal) {
        closeModal(productDetailModal);
        if (voucherCountdownInterval) {
            clearInterval(voucherCountdownInterval);
            voucherCountdownInterval = null;
        }
    }
});
orderCreationModal.addEventListener('click', (e) => { if (e.target === orderCreationModal) closeModal(orderCreationModal); });
editShippingOrderModal.addEventListener('click', (e) => { if (e.target === editShippingOrderModal) closeModal(editShippingOrderModal); });
shopManagementModal.addEventListener('click', (e) => { if (e.target === shopManagementModal) closeModal(shopManagementModal); });
shopSettingsModal.addEventListener('click', (e) => { if (e.target === shopSettingsModal) closeModal(shopSettingsModal); });
shopAnalyticsModal.addEventListener('click', (e) => { if (e.target === shopAnalyticsModal) closeModal(shopAnalyticsModal); });
cartModal.addEventListener('click', (e) => { if (e.target === cartModal) closeModal(cartModal); });
paymentVATModal.addEventListener('click', (e) => { if (e.target === paymentVATModal) closeModal(paymentVATModal); });
orderTrackingModal.addEventListener('click', (e) => { if (e.target === orderTrackingModal) closeModal(orderTrackingModal); });
paymentWarrantyModal.addEventListener('click', (e) => { if (e.target === paymentWarrantyModal) closeModal(paymentWarrantyModal); });
loginRegisterModal.addEventListener('click', (e) => { if (e.target === loginRegisterModal) closeModal(loginRegisterModal); });
profileModal.addEventListener('click', (e) => { if (e.target === profileModal) closeModal(profileModal); });
chatModal.addEventListener('click', (e) => { if (e.target === chatModal) closeModal(chatModal); }); // Close chat modal

openManagementModalBtn.addEventListener('click', () => {
    if (!loggedInUser) {
        showNotification('Vui lòng đăng nhập để sử dụng chức năng này.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    if (!loggedInUser.isAdmin) {
        showNotification('Bạn không có quyền truy cập chức năng này.', 'info');
        return;
    }
    openModal(shopManagementModal);
    renderProductManagementList();
    renderWarrantyPackagesList();
    resetAddEditProductForm();
    resetAddEditWarrantyPackageForm();
});
openSettingsModalBtn.addEventListener('click', () => {
    if (!loggedInUser) {
        showNotification('Vui lòng đăng nhập để sử dụng chức năng này.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    if (!loggedInUser.isAdmin) {
        showNotification('Bạn không có quyền truy cập chức năng này.', 'info');
        return;
    }
    openModal(shopSettingsModal);
});
openShopAnalyticsModalBtn.addEventListener('click', () => {
    if (!loggedInUser) {
        showNotification('Vui lòng đăng nhập để sử dụng chức năng này.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    if (!loggedInUser.isAdmin) {
        showNotification('Bạn không có quyền truy cập chức năng này.', 'info');
        return;
    }
    openModal(shopAnalyticsModal);
    generateShopReport();
});
openCartModalBtn.addEventListener('click', () => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    openModal(cartModal);
    renderCart();
});

showProductsBtn.addEventListener('click', (e) => showSection('product-list-section', e.target));
showCreatedOrdersBtn.addEventListener('click', (e) => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để xem đơn hàng.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    showSection('created-orders-section', e.target);
    renderOrders('created');
});
showShippingOrdersBtn.addEventListener('click', (e) => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để xem đơn hàng.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    showSection('shipping-orders-section', e.target);
    renderOrders('shipping');
});
showDeliveredOrdersBtn.addEventListener('click', (e) => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để xem đơn hàng.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    showSection('delivered-orders-section', e.target);
    renderOrders('delivered');
});
openProfileModalBtn.addEventListener('click', () => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để xem hồ sơ.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    renderProfileModal();
    openModal(profileModal);
});

document.querySelectorAll('.toggle-visibility-btn').forEach(button => {
    button.addEventListener('click', function() {
        const targetId = this.dataset.targetId;
        const targetInput = document.getElementById(targetId);
        const isBlurred = targetInput.classList.contains('blurred-content');
        if (isBlurred) {
            targetInput.classList.remove('blurred-content');
            this.innerHTML = '<i class="fas fa-eye"></i>';
        } else {
            targetInput.classList.add('blurred-content');
            this.innerHTML = '<i class="fas fa-eye-slash"></i>';
        }
    });
});

headerProductSearchInput.addEventListener('input', () => {
    renderProducts(headerProductSearchInput.value.trim());
});

// Category filtering event listeners
document.querySelectorAll('.category-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const category = e.currentTarget.dataset.category;
        renderProducts(headerProductSearchInput.value.trim(), category === 'All' ? '' : category);
        // Optional: Highlight the selected category button
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active-category'));
        e.currentTarget.classList.add('active-category');
    });
});


function renderProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card bg-white rounded-xl shadow-lg p-6 flex flex-col items-center text-center hover:shadow-xl transition-shadow duration-300 relative';
    const starsHtml = '<div class="star-rating text-yellow-400 mb-2">' + '<i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>' + ` <span class="text-gray-600 text-sm">(${product.reviewsCount || 0} đánh giá)</span>` + '</div>';
    card.innerHTML = `
        <img src="${product.image}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/cccccc/333333?text=No+Image';" alt="${product.name}" class="w-full h-48 object-cover rounded-lg mb-4 shadow-md">
        <h3 class="text-xl font-semibold mb-2 text-gray-900">${product.name}</h3>
        <p class="text-lg text-gray-700">Giá gốc: <span class="font-bold">${formatCurrency(product.basePrice)}</span></p>
        <p class="text-sm text-gray-500">Danh mục: ${product.category || 'Chưa phân loại'}</p>
        ${starsHtml}
        <button data-product-id="${product.id}" class="view-product-btn mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-full transition-all duration-200 shadow-md">Xem chi tiết</button>
    `;
    return card;
}

function renderProducts(searchTerm = '', categoryFilter = '') {
    const productGrid = document.getElementById('product-grid');
    productGrid.innerHTML = '';
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    let filteredProducts = shopDataCache.products;

    // Apply category filter
    if (categoryFilter) {
        filteredProducts = filteredProducts.filter(product =>
            product.category && product.category.toLowerCase() === categoryFilter.toLowerCase()
        );
    }

    // Apply search term filter
    filteredProducts = filteredProducts.filter(product =>
        product.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        product.description.toLowerCase().includes(lowerCaseSearchTerm)
    );

    if (filteredProducts.length === 0) {
        productGrid.innerHTML = '<p class="text-gray-500 italic text-center col-span-full">Không tìm thấy sản phẩm nào.</p>';
        return;
    }

    filteredProducts.forEach(product => {
        productGrid.appendChild(renderProductCard(product));
    });

    document.querySelectorAll('.view-product-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const productId = e.target.dataset.productId;
            const product = shopDataCache.products.find(p => p.id === productId);
            if (product) {
                if (!loggedInUser || !loggedInUser.id) {
                    showNotification('Vui lòng đăng nhập để xem chi tiết sản phẩm.', 'info');
                    openModal(loginRegisterModal);
                    return;
                }
                displayProductDetail(product);
            }
        });
    });
}

function displayProductDetail(product) {
    currentSelectedProduct = product;
    currentSelectedOptions = {};
    currentAppliedVoucher = null;
    voucherCodeInput.value = '';
    modalProductName.textContent = product.name;
    modalProductImage.src = product.image;
    modalProductBasePrice.textContent = formatCurrency(product.basePrice);
    modalProductDescription.textContent = product.description;
    productOptionsContainer.innerHTML = '';
    voucherExpiryMessage.classList.add('hidden');

    if (voucherCountdownInterval) {
        clearInterval(voucherCountdownInterval);
        voucherCountdownInterval = null;
    }

    if (product.colors && product.colors.length > 0) {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'flex flex-col space-y-2';
        colorDiv.innerHTML = '<p class="text-gray-700 font-semibold mb-2">Màu sắc:</p>';
        const colorButtonsDiv = document.createElement('div');
        colorButtonsDiv.className = 'flex flex-wrap gap-2';
        product.colors.forEach(color => {
            const btn = document.createElement('button');
            btn.className = 'option-button bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-full transition-all duration-200 text-sm';
            btn.textContent = color.name;
            btn.dataset.type = 'color';
            btn.dataset.value = color.name;
            btn.dataset.priceImpact = color.priceImpact;
            btn.dataset.displayImage = color.display_image || '';
            colorButtonsDiv.appendChild(btn);
            btn.addEventListener('click', () => selectOption('color', color.name, color.priceImpact, btn, color.display_image));
        });
        colorDiv.appendChild(colorButtonsDiv);
        productOptionsContainer.appendChild(colorDiv);
        selectOption('color', product.colors[0].name, product.colors[0].priceImpact, colorButtonsDiv.children[0], product.colors[0].display_image);
    } else {
        currentSelectedOptions.color = null;
    }

    if (product.storages && product.storages.length > 0) {
        const storageDiv = document.createElement('div');
        storageDiv.className = 'flex flex-col space-y-2';
        storageDiv.innerHTML = '<p class="text-gray-700 font-semibold mb-2">Dung lượng:</p>';
        const storageButtonsDiv = document.createElement('div');
        storageButtonsDiv.className = 'flex flex-wrap gap-2';
        product.storages.forEach(storage => {
            const btn = document.createElement('button');
            btn.className = 'option-button bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-full transition-all duration-200 text-sm';
            btn.textContent = storage.name;
            btn.dataset.type = 'storage';
            btn.dataset.value = storage.name;
            btn.dataset.priceImpact = storage.priceImpact;
            storageButtonsDiv.appendChild(btn);
            btn.addEventListener('click', () => selectOption('storage', storage.name, storage.priceImpact, btn));
        });
        storageDiv.appendChild(storageButtonsDiv);
        productOptionsContainer.appendChild(storageDiv);
        selectOption('storage', product.storages[0].name, product.storages[0].priceImpact, storageButtonsDiv.children[0]);
    } else {
        currentSelectedOptions.storage = null;
    }
    calculateProductPrice();
    openModal(productDetailModal);
}

function selectOption(type, value, priceImpact, button, displayImage = null) {
    document.querySelectorAll(`.option-button[data-type="${type}"]`).forEach(btn => {
        btn.classList.remove('selected');
    });
    if (button) {
        button.classList.add('selected');
    }
    currentSelectedOptions[type] = { value, priceImpact: parseFloat(priceImpact) };
    if (type === 'color' && displayImage) {
        modalProductImage.src = displayImage;
    } else if (type === 'color' && !displayImage) {
        modalProductImage.src = currentSelectedProduct.image;
    }
    calculateProductPrice();
}

function updateVoucherCountdown() {
    if (!currentAppliedVoucher || !currentAppliedVoucher.expiry) {
        voucherExpiryMessage.classList.add('hidden');
        if (voucherCountdownInterval) {
            clearInterval(voucherCountdownInterval);
            voucherCountdownInterval = null;
        }
        return;
    }

    const now = new Date();
    const expiryTime = new Date(currentAppliedVoucher.expiry);
    const timeLeft = expiryTime.getTime() - now.getTime();

    if (timeLeft <= 0) {
        currentAppliedVoucher = null;
        voucherExpiryMessage.classList.add('hidden');
        showNotification('Mã voucher đã hết hạn.', 'error');
        if (voucherCountdownInterval) {
            clearInterval(voucherCountdownInterval);
            voucherCountdownInterval = null;
        }
        calculateProductPrice();
        return;
    }

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    const formattedTime = [hours, minutes, seconds]
        .map(unit => unit.toString().padStart(2, '0'))
        .join(':');

    voucherExpiryMessage.textContent = `(Voucher giá trị ${currentAppliedVoucher.displayValue} sẽ hết hạn sau ${formattedTime})`;
    voucherExpiryMessage.classList.remove('hidden');
}

function calculateProductPrice() {
    let basePrice = currentSelectedProduct.basePrice;
    let priceAfterOptions = basePrice;

    for (const type in currentSelectedOptions) {
        priceAfterOptions += (currentSelectedOptions[type] && currentSelectedOptions[type].priceImpact) || 0;
    }

    const selectedColor = currentSelectedOptions.color ? currentSelectedOptions.color.value : null;
    const selectedStorage = currentSelectedOptions.storage ? currentSelectedOptions.storage.value : null;

    let variant = null;
    if (currentSelectedProduct.variants) {
        variant = currentSelectedProduct.variants.find(v =>
            v.color === selectedColor && v.storage === selectedStorage
        );
    }

    let finalPrice = priceAfterOptions;
    let remainingQuantity = 'N/A';
    let soldQuantity = 'N/A';

    if (variant) {
        finalPrice += variant.priceImpact || 0;
        remainingQuantity = variant.quantity !== undefined ? variant.quantity : 'N/A';
        soldQuantity = variant.sold !== undefined ? variant.sold : 'N/A';
        if (remainingQuantity <= 0) {
            buyNowDetailBtn.disabled = true;
            addToCartDetailBtn.disabled = true;
            modalProductRemaining.classList.add('out-of-stock');
            modalProductRemaining.textContent = 'Hết hàng';
        } else {
            buyNowDetailBtn.disabled = false;
            addToCartDetailBtn.disabled = false;
            modalProductRemaining.classList.remove('out-of-stock');
            modalProductRemaining.textContent = remainingQuantity;
        }
    } else {
        buyNowDetailBtn.disabled = false;
        addToCartDetailBtn.disabled = false;
        modalProductRemaining.classList.remove('out-of-stock');
    }

    currentPriceBeforeVoucherAndVAT = finalPrice;

    let totalVatForProduct = currentPriceBeforeVoucherAndVAT * 0.10;
    let customerVatPortion = totalVatForProduct * 0.20;

    let discountedPrice = finalPrice;

    if (currentAppliedVoucher) {
        const now = new Date();
        const expiryTime = new Date(currentAppliedVoucher.expiry);
        if (expiryTime > now) {
            if (currentAppliedVoucher.type === 'percentage') {
                discountedPrice = finalPrice * (1 - currentAppliedVoucher.value);
            } else if (currentAppliedVoucher.type === 'fixed') {
                discountedPrice = finalPrice - currentAppliedVoucher.value;
            } else if (currentAppliedVoucher.type === 'freeship') {
                // Freeship logic handled at order creation/payment
            }
            if (voucherCountdownInterval) {
                clearInterval(voucherCountdownInterval);
            }
            voucherCountdownInterval = setInterval(updateVoucherCountdown, 1000);
            updateVoucherCountdown();
        } else {
            currentAppliedVoucher = null;
            showNotification('Mã voucher đã hết hạn.', 'error');
            if (voucherCountdownInterval) {
                clearInterval(voucherCountdownInterval);
                voucherCountdownInterval = null;
            }
            voucherExpiryMessage.classList.add('hidden');
        }
    } else {
        voucherExpiryMessage.classList.add('hidden');
        if (voucherCountdownInterval) {
            clearInterval(voucherCountdownInterval);
            voucherCountdownInterval = null;
        }
    }

    currentCalculatedPrice = discountedPrice;

    modalProductPriceDisplay.textContent = formatCurrency(finalPrice);
    modalProductVATDisplay.textContent = formatCurrency(customerVatPortion);
    modalProductSold.textContent = soldQuantity;
    modalProductRemaining.textContent = remainingQuantity;

    if (currentAppliedVoucher) {
        modalProductDiscountDisplay.classList.remove('hidden');
        modalProductDiscountDisplay.textContent = `Giá sau voucher: ${formatCurrency(discountedPrice)}`;
    } else {
        modalProductDiscountDisplay.classList.add('hidden');
    }
}

applyVoucherBtn.addEventListener('click', () => {
    const voucherCode = voucherCodeInput.value.trim().toUpperCase();
    const voucher = shopDataCache.vouchers[voucherCode];

    if (voucher) {
        if (voucher.isAdminVoucher && (!loggedInUser || !loggedInUser.isAdmin)) {
            currentAppliedVoucher = null;
            showNotification('Mã voucher này chỉ dành cho quản trị viên.', 'error');
            calculateProductPrice();
            return;
        }

        const now = new Date();
        const expiryTime = new Date(voucher.expiry);

        if (expiryTime > now) {
            currentAppliedVoucher = {
                code: voucherCode,
                type: voucher.type,
                value: voucher.value,
                expiry: voucher.expiry,
                displayValue: voucher.displayValue,
                isAdminVoucher: voucher.isAdminVoucher
            };
            showNotification(`Áp dụng voucher thành công!`, 'success');
        } else {
            currentAppliedVoucher = null;
            showNotification('Mã voucher đã hết hạn.', 'error');
        }
    } else {
        currentAppliedVoucher = null;
        showNotification('Mã voucher không hợp lệ hoặc không tồn tại.', 'error');
    }
    calculateProductPrice();
});

buyNowDetailBtn.addEventListener('click', () => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để mua hàng.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    productsToOrder = [{
        product: currentSelectedProduct,
        options: currentSelectedOptions,
        quantity: 1,
        priceAtOrder: currentCalculatedPrice,
        originalPriceForVAT: currentPriceBeforeVoucherAndVAT,
        voucher: currentAppliedVoucher
    }];
    isBuyNowFlow = true;
    openModal(orderCreationModal);
    populateOrderCreationModal();
});

addToCartDetailBtn.addEventListener('click', async () => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    showLoading();
    const selectedColor = currentSelectedOptions.color ? currentSelectedOptions.color.value : null;
    const selectedStorage = currentSelectedOptions.storage ? currentSelectedOptions.storage.value : null;

    const existingCartItemIndex = userCartCache.findIndex(item =>
        item.productId === currentSelectedProduct.id &&
        (item.selectedColor ? item.selectedColor.value === selectedColor : !selectedColor) &&
        (item.selectedStorage ? item.selectedStorage.value === selectedStorage : !selectedStorage)
    );

    if (existingCartItemIndex > -1) {
        userCartCache[existingCartItemIndex].quantity += 1;
    } else {
        userCartCache.push({
            productId: currentSelectedProduct.id,
            productName: currentSelectedProduct.name,
            productImage: currentSelectedProduct.image,
            selectedColor: currentSelectedOptions.color,
            selectedStorage: currentSelectedOptions.storage,
            priceAtAddToCart: currentCalculatedPrice,
            originalPriceForVAT: currentPriceBeforeVoucherAndVAT,
            quantity: 1
        });
    }
    await saveUserCart();
    updateCartCount();
    hideLoading();
    showNotification('Đã thêm sản phẩm vào giỏ hàng!', 'success');
});

async function updateCart(itemIndex, newQuantity) {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để cập nhật giỏ hàng.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    if (newQuantity <= 0) {
        userCartCache.splice(itemIndex, 1);
    } else {
        userCartCache[itemIndex].quantity = newQuantity;
    }
    await saveUserCart();
    renderCart();
    updateCartCount();
}

async function renderCart(searchTerm = '') {
    cartItemsList.innerHTML = '';
    let totalAmount = 0;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const filteredCart = userCartCache.filter(item =>
        item.productName.toLowerCase().includes(lowerCaseSearchTerm)
    );

    if (filteredCart.length === 0) {
        cartItemsList.innerHTML = '<p class="text-gray-500 italic text-center">Giỏ hàng trống.</p>';
        cartTotalAmountSpan.textContent = formatCurrency(0);
        return;
    }

    filteredCart.forEach((item, index) => {
        const itemTotalVAT = item.originalPriceForVAT * 0.10;
        const itemCustomerVATPortion = itemTotalVAT * 0.20;

        const itemTotal = (item.priceAtAddToCart + itemCustomerVATPortion) * item.quantity;
        totalAmount += itemTotal;

        const cartItemDiv = document.createElement('div');
        cartItemDiv.className = 'flex items-center space-x-4 p-4 bg-white rounded-lg shadow-md';
        cartItemDiv.innerHTML = `
            <img src="${item.productImage}" onerror="this.onerror=null;this.src='https://placehold.co/80x80/cccccc/333333?text=No+Image';" alt="${item.productName}" class="w-20 h-20 object-cover rounded-lg">
            <div class="flex-1">
                <h4 class="font-semibold text-lg text-gray-900">${item.productName}</h4>
                <p class="text-sm text-gray-600">
                    ${item.selectedColor ? `Màu: ${item.selectedColor.value}` : ''}
                    ${item.selectedStorage ? ` - Dung lượng: ${item.selectedStorage.value}` : ''}
                </p>
                <p class="text-md text-gray-700">Giá (chưa VAT): ${formatCurrency(item.priceAtAddToCart)}</p>
                <p class="text-md text-gray-700">VAT (khách trả): ${formatCurrency(itemCustomerVATPortion)}</p>
            </div>
            <div class="flex items-center space-x-2">
                <button class="quantity-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded-full" data-index="${index}" data-action="decrease">-</button>
                <span class="font-semibold text-gray-800">${item.quantity}</span>
                <button class="quantity-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded-full" data-index="${index}" data-action="increase">+</button>
            </div>
            <button class="remove-from-cart-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg" data-index="${index}">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        cartItemsList.appendChild(cartItemDiv);
    });

    cartTotalAmountSpan.textContent = formatCurrency(totalAmount);

    document.querySelectorAll('.quantity-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            const action = e.target.dataset.action;
            let newQuantity = userCartCache[index].quantity;
            if (action === 'increase') {
                newQuantity++;
            } else {
                newQuantity--;
            }
            updateCart(index, newQuantity);
        });
    });

    document.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            updateCart(index, 0);
        });
    });
}

buyAllCartBtn.addEventListener('click', () => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để mua hàng.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    if (userCartCache.length === 0) {
        showNotification('Giỏ hàng của bạn đang trống.', 'info');
        return;
    }
    productsToOrder = userCartCache.map(item => ({
        product: shopDataCache.products.find(p => p.id === item.productId),
        options: {
            color: item.selectedColor,
            storage: item.selectedStorage
        },
        quantity: item.quantity,
        priceAtOrder: item.priceAtAddToCart,
        originalPriceForVAT: item.originalPriceForVAT,
        voucher: null
    }));
    isBuyNowFlow = false;
    openModal(orderCreationModal);
    populateOrderCreationModal();
});

searchCartItemsInput.addEventListener('input', () => {
    renderCart(searchCartItemsInput.value.trim());
});
clearSearchCartItemsBtn.addEventListener('click', () => {
    searchCartItemsInput.value = '';
    renderCart();
});

function populateOrderCreationModal() {
    orderIdDisplay.textContent = generateId();
    orderProductsSummary.innerHTML = '';
    let totalOrderPrice = 0;
    let totalVATCustomerPays = 0;
    let totalOriginalPrice = 0;

    productsToOrder.forEach(item => {
        const productSummaryDiv = document.createElement('div');
        productSummaryDiv.className = 'flex items-center space-x-3 mb-2';

        const itemTotalVAT = item.originalPriceForVAT * 0.10;
        const itemCustomerVATPortion = itemTotalVAT * 0.20;

        const itemPriceIncludingCustomerVAT = item.priceAtOrder + itemCustomerVATPortion;
        const itemTotalPrice = itemPriceIncludingCustomerVAT * item.quantity;

        totalOrderPrice += itemTotalPrice;
        totalVATCustomerPays += itemCustomerVATPortion * item.quantity;
        totalOriginalPrice += item.originalPriceForVAT * item.quantity;

        productSummaryDiv.innerHTML = `
            <img src="${item.product.image}" onerror="this.onerror=null;this.src='https://placehold.co/50x50/cccccc/333333?text=SP';" class="w-12 h-12 object-cover rounded-md">
            <div class="flex-1">
                <p class="font-semibold text-gray-800">${item.product.name} ${item.options.color ? `(${item.options.color.value})` : ''} ${item.options.storage ? `(${item.options.storage.value})` : ''}</p>
                <p class="text-sm text-gray-600">Số lượng: ${item.quantity} x ${formatCurrency(item.priceAtOrder)} (Giá gốc)</p>
                <p class="text-sm text-gray-600">VAT (khách trả): ${formatCurrency(itemCustomerVATPortion)}</p>
            </div>
            <span class="font-bold text-gray-900">${formatCurrency(itemTotalPrice)}</span>
        `;
        orderProductsSummary.appendChild(productSummaryDiv);
    });

    const totalDiv = document.createElement('div');
    totalDiv.className = 'flex justify-between items-center border-t pt-2 mt-2 font-bold text-lg';
    totalDiv.innerHTML = `<span>Tổng cộng:</span><span>${formatCurrency(totalOrderPrice)}</span>`;
    orderProductsSummary.appendChild(totalDiv);

    customerNameInput.value = loggedInUser.fullname || '';
    customerPhoneInput.value = loggedInUser.phone || '';
    customerAddressInput.value = loggedInUser.province || '';
    orderLocationInput.value = DEFAULT_WAREHOUSE_ADDRESS;
    const today = new Date();
    today.setDate(today.getDate() + 3);
    estimatedDeliveryDateInput.value = today.toISOString().split('T')[0];

    orderStatusSteps.forEach(step => step.classList.remove('active'));
    document.querySelector('.order-status-step[data-status="created"]').classList.add('active');
}

orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để tạo đơn hàng.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    showLoading();

    const orderId = orderIdDisplay.textContent;
    const customerName = customerNameInput.value.trim();
    const customerPhone = customerPhoneInput.value.trim();
    const customerAddress = customerAddressInput.value.trim();
    const orderLocation = orderLocationInput.value.trim();
    const estimatedDeliveryDate = estimatedDeliveryDateInput.value;

    let totalAmount = 0;
    let totalVATOriginal = 0;
    let totalVATCustomerPays = 0;
    let totalShopSupportVAT = 0;
    let totalOriginalProductPrice = 0;

    const orderItems = productsToOrder.map(item => {
        const product = item.product;
        const selectedVariant = product.variants.find(v =>
            v.color === (item.options.color ? item.options.color.value : null) &&
            v.storage === (item.options.storage ? item.options.storage.value : null)
        );

        if (selectedVariant && selectedVariant.quantity < item.quantity) {
            showNotification(`Sản phẩm "${product.name}" (${item.options.color?.value || ''} ${item.options.storage?.value || ''}) không đủ số lượng. Chỉ còn ${selectedVariant.quantity} sản phẩm.`, 'error');
            hideLoading();
            return null;
        }

        const itemOriginalPrice = item.originalPriceForVAT;
        const itemPriceAfterVoucher = item.priceAtOrder;

        const itemTotalVAT = itemOriginalPrice * 0.10;
        const itemCustomerVATPortion = itemTotalVAT * 0.20;
        const itemShopSupportVAT = itemTotalVAT * 0.80;

        const itemTotal = (itemPriceAfterVoucher + itemCustomerVATPortion) * item.quantity;

        totalAmount += itemTotal;
        totalVATOriginal += itemTotalVAT * item.quantity;
        totalVATCustomerPays += itemCustomerVATPortion * item.quantity;
        totalShopSupportVAT += itemShopSupportVAT * item.quantity;
        totalOriginalProductPrice += itemOriginalPrice * item.quantity;

        return {
            productId: product.id,
            productName: product.name,
            productImage: product.image,
            selectedColor: item.options.color,
            selectedStorage: item.options.storage,
            quantity: item.quantity,
            priceAtOrder: itemPriceAfterVoucher,
            originalPriceForVAT: itemOriginalPrice,
            totalVAT: itemTotalVAT,
            customerVATPortion: itemCustomerVATPortion,
            shopSupportVAT: itemShopSupportVAT,
            voucher: item.voucher ? { ...item.voucher } : null
        };
    }).filter(item => item !== null);

    if (orderItems.length !== productsToOrder.length) {
        hideLoading();
        return;
    }

    const newOrder = {
        id: orderId,
        userId: loggedInUser.id,
        customerName,
        customerPhone,
        customerAddress,
        orderLocation,
        estimatedDeliveryDate,
        orderDate: new Date().toISOString(),
        status: 'created',
        items: orderItems,
        totalAmount: totalAmount,
        totalVATOriginal: totalVATOriginal,
        totalVATCustomerPays: totalVATCustomerPays,
        totalShopSupportVAT: totalShopSupportVAT,
        totalOriginalProductPrice: totalOriginalProductPrice,
        vatPaymentStatus: 'pending',
        warrantyPackage: null,
        warrantyPaymentStatus: 'pending',
        appliedVoucherCode: currentAppliedVoucher ? currentAppliedVoucher.code : null,
        appliedVoucherDisplayValue: currentAppliedVoucher ? currentAppliedVoucher.displayValue : null
    };

    try {
        await setDoc(doc(db, `artifacts/${appId}/users/${loggedInUser.id}/orders`, newOrder.id), newOrder);
        console.log(`Order ${newOrder.id} saved to user's collection.`);

        await setDoc(doc(collection(db, `artifacts/${appId}/public/data/adminOrders`), newOrder.id), { ...newOrder, customerUserId: loggedInUser.id });
        console.log(`Order ${newOrder.id} saved to admin collection.`);

        if (currentAppliedVoucher && !currentAppliedVoucher.isAdminVoucher && shopDataCache.vouchers[currentAppliedVoucher.code]) {
            delete shopDataCache.vouchers[currentAppliedVoucher.code];
            console.log(`Voucher ${currentAppliedVoucher.code} removed after successful order.`);
        }


        for (const item of productsToOrder) {
            const productIndex = shopDataCache.products.findIndex(p => p.id === item.product.id);
            if (productIndex > -1) {
                const selectedColor = item.options.color ? item.options.color.value : null;
                const selectedStorage = item.options.storage ? item.options.storage.value : null;
                const variantIndex = shopDataCache.products[productIndex].variants.findIndex(v =>
                    v.color === selectedColor && v.storage === selectedStorage
                );
                if (variantIndex > -1) {
                    shopDataCache.products[productIndex].variants[variantIndex].quantity -= item.quantity;
                    shopDataCache.products[productIndex].variants[variantIndex].sold = (shopDataCache.products[productIndex].variants[variantIndex].sold || 0) + item.quantity;
                }
            }
        }
        await saveShopData();
        console.log("Shop data (product quantities) updated.");

        if (!isBuyNowFlow) {
            userCartCache = [];
            await saveUserCart();
            updateCartCount();
        }

        hideLoading();
        showNotification('Đơn hàng đã được tạo thành công!', 'success');
        closeModal(orderCreationModal);
        closeModal(productDetailModal);
        renderOrders('created');
    } catch (error) {
        hideLoading();
        console.error("Error creating order:", error);
        showNotification(`Lỗi khi tạo đơn hàng: ${error.message}`, 'error');
    }
});

/**
 * Debounce function to limit how often a function is called.
 * @param {function} func The function to debounce.
 * @param {number} delay The delay in milliseconds.
 * @returns {function} The debounced function.
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

const debouncedRenderCreatedOrders = debounce(() => renderOrders('created'), 1500);
const debouncedRenderShippingOrders = debounce(() => renderOrders('shipping'), 1500);
const debouncedRenderDeliveredOrders = debounce(() => renderOrders('delivered'), 1500);

async function renderOrders(status) {
    const orderListElement = document.getElementById(`${status}-orders-list`);
    const searchInput = document.getElementById(`search-${status}-orders`);
    orderListElement.innerHTML = '<p class="text-gray-500 italic text-center">Đang tải đơn hàng...</p>';
    showLoading();

    try {
        let orders = [];
        if (loggedInUser && loggedInUser.isAdmin) {
            const q = query(collection(db, `artifacts/${appId}/public/data/adminOrders`), where('status', '==', status));
            const querySnapshot = await getDocs(q);
            orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`Admin orders for status ${status}:`, orders);
        } else if (loggedInUser && loggedInUser.id) {
            const q = query(collection(db, `artifacts/${appId}/users/${loggedInUser.id}/orders`), where('status', '==', status));
            const querySnapshot = await getDocs(q);
            orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`User ${loggedInUser.id} orders for status ${status}:`, orders);
        } else {
            orderListElement.innerHTML = '<p class="text-gray-500 italic text-center">Vui lòng đăng nhập để xem đơn hàng của bạn.</p>';
            hideLoading();
            return;
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const filteredOrders = orders.filter(order =>
            order.customerName.toLowerCase().includes(searchTerm) ||
            order.customerPhone.includes(searchTerm)
        );

        orderListElement.innerHTML = '';
        if (filteredOrders.length === 0) {
            orderListElement.innerHTML = '<p class="text-gray-500 italic text-center">Chưa có đơn hàng nào trong mục này.</p>';
        } else {
            filteredOrders.forEach(order => {
                const orderCard = document.createElement('div');
                orderCard.className = 'bg-transparent rounded-xl shadow-lg p-6 mb-4';
                orderCard.innerHTML = `
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-xl font-bold text-gray-900">Đơn hàng #${order.id}</h4>
                        <span class="text-sm font-medium text-gray-600">Ngày đặt: ${new Date(order.orderDate).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p class="text-gray-700 mb-2"><strong>Khách hàng:</strong> ${order.customerName} (ID: ${order.userId})</p>
                    <p class="text-gray-700 mb-2"><strong>SĐT:</strong> <span class="blurred-content" id="order-phone-${order.id}">${order.customerPhone}</span> <button type="button" class="toggle-visibility-btn text-blue-500 hover:underline" data-target-id="order-phone-${order.id}"><i class="fas fa-eye"></i></button></p>
                    <p class="text-gray-700 mb-2"><strong>Địa chỉ:</strong> <span class="blurred-content" id="order-address-${order.id}">${order.customerAddress}</span> <button type="button" class="toggle-visibility-btn text-blue-500 hover:underline" data-target-id="order-address-${order.id}"><i class="fas fa-eye"></i></button></p>
                    <p class="text-gray-700 mb-2"><strong>Vị trí hiện tại:</strong> ${order.orderLocation || 'N/A'}</p>
                    <p class="text-gray-700 mb-2"><strong>Ngày dự kiến giao:</strong> ${order.estimatedDeliveryDate || 'N/A'}</p>
                    <p class="text-gray-700 mb-2"><strong>Tổng tiền:</strong> ${formatCurrency(order.totalAmount)}</p>
                    <p class="text-gray-700 mb-2"><strong>VAT (Khách trả):</strong> ${formatCurrency(order.totalVATCustomerPays)} (${order.vatPaymentStatus === 'paid' ? 'Đã thanh toán' : (order.vatPaymentStatus === 'pending_admin' ? 'Đang xác nhận thanh toán' : 'Chưa thanh toán')})</p>
                    <p class="text-gray-700 mb-2"><strong>VAT (Shop đã thanh toán cho khách 8%) :</strong> ${formatCurrency(order.totalShopSupportVAT)}</p>
                    <p class="text-gray-700 mb-2"><strong>Gói bảo hành:</strong> ${order.warrantyPackage ? `${order.warrantyPackage.name} (${formatCurrency(order.warrantyPackage.price - (order.warrantyPackage.price * order.warrantyPackage.discount / 100))})` : 'Chưa đăng ký'}</p>
                    <p class="text-gray-700 mb-4"><strong>Trạng thái bảo hành:</strong> ${order.warrantyPackage ? (order.warrantyPaymentStatus === 'paid' ? 'Đã thanh toán' : (order.warrantyPaymentStatus === 'pending_admin' ? 'Đang xác nhận thanh toán' : 'Chờ xác nhận')) : 'Miễn phí đổi trả trong 30 ngày'}</p>
                    ${order.appliedVoucherCode ? `<p class="text-gray-700 mb-2"><strong>Voucher đã dùng:</strong> ${order.appliedVoucherCode} ${order.appliedVoucherDisplayValue ? `(${order.appliedVoucherDisplayValue})` : ''}</p>` : ''}
                    <p class="text-red-600 font-bold mb-2">Thanh toán khi nhận hàng: ${formatCurrency(order.totalAmount - order.totalVATCustomerPays)}</p>

                    <div class="order-expandable-content" id="order-items-${order.id}">
                        <h5 class="font-semibold text-gray-800 mb-2">Sản phẩm:</h5>
                        ${(order.items || []).map(item => `
                            <div class="flex items-center space-x-3 mb-1 text-sm">
                                <img src="${item.productImage}" onerror="this.onerror=null;this.src='https://placehold.co/40x40/cccccc/333333?text=SP';" class="w-10 h-10 object-cover rounded-md">
                                <p class="flex-1">${item.productName} ${item.selectedColor ? `(${item.selectedColor.value})` : ''} ${item.selectedStorage ? `(${item.selectedStorage.value})` : ''} x ${item.quantity}</p>
                                <span class="font-semibold">${formatCurrency((item.priceAtOrder + item.customerVATPortion) * item.quantity)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="toggle-order-details-btn text-blue-600 hover:underline text-sm mt-2">Xem chi tiết sản phẩm</button>
                    <div class="mt-4 flex flex-wrap gap-2">
                        ${loggedInUser && loggedInUser.isAdmin ? `
                            ${status === 'created' ? `<button class="admin-approve-btn bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200" data-order-id="${order.id}" data-customer-user-id="${order.userId}" data-action-type="approve_created">Phê duyệt (Vận chuyển)</button>` : ''}
                            ${status === 'shipping' ? `
                                <button class="admin-approve-btn bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200" data-order-id="${order.id}" data-customer-user-id="${order.userId}" data-action-type="approve_shipping">Phê duyệt (Đã giao)</button>
                                <button class="admin-edit-shipping-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200" data-order-id="${order.id}">Chi tiết vận chuyển</button>
                            ` : ''}
                            <button class="admin-cancel-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200" data-order-id="${order.id}" data-customer-user-id="${order.userId}">Hủy</button>
                        ` : `
                            ${status === 'created' ? `
                                <button class="pay-vat-btn bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200" data-order-id="${order.id}">Thanh toán VAT</button>
                                <button class="add-warranty-btn bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200" data-order-id="${order.id}">Mua gói bảo hành</button>
                            ` : ''}
                            ${status === 'shipping' ? `
                                <button class="track-order-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200" data-order-id="${order.id}">Theo dõi đơn hàng</button>
                            ` : ''}
                            ${status === 'delivered' ? `
                                <button class="return-exchange-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-all duration-200" data-order-id="${order.id}">Đổi/Trả</button>
                            ` : ''}
                        `}
                    </div>
                `;
                orderListElement.appendChild(orderCard);
            });

            document.querySelectorAll('.toggle-visibility-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const targetId = this.dataset.targetId;
                    const targetElement = document.getElementById(targetId);
                    const isBlurred = targetElement.classList.contains('blurred-content');
                    if (isBlurred) {
                        targetElement.classList.remove('blurred-content');
                        this.innerHTML = '<i class="fas fa-eye"></i>';
                    } else {
                        targetElement.classList.add('blurred-content');
                        this.innerHTML = '<i class="fas fa-eye-slash"></i>';
                    }
                });
            });

            document.querySelectorAll('.toggle-order-details-btn').forEach(button => {
                button.addEventListener('click', function() {
                    const orderId = this.closest('.bg-transparent').querySelector('h4').textContent.replace('Đơn hàng #', '');
                    const currentOrder = orders.find(o => o.id === orderId);
                    if (currentOrder) {
                        const content = document.getElementById(`order-items-${currentOrder.id}`);
                        if (content) {
                            content.classList.toggle('expanded');
                            if (content.classList.contains('expanded')) {
                                this.textContent = 'Thu gọn chi tiết sản phẩm';
                            } else {
                                this.textContent = 'Xem chi tiết sản phẩm';
                            }
                        }
                    }
                });
            });

            document.querySelectorAll('.admin-approve-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const orderId = e.target.dataset.orderId;
                    const customerUserId = e.target.dataset.customerUserId;
                    const actionType = e.target.dataset.actionType;
                    await updateOrderStatus(orderId, customerUserId, actionType);
                });
            });

            document.querySelectorAll('.admin-cancel-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const orderId = e.target.dataset.orderId;
                    const customerUserId = e.target.dataset.customerUserId;
                    if (confirm('Bạn có chắc chắn muốn hủy đơn hàng này?')) {
                        await deleteOrder(orderId, customerUserId);
                    }
                });
            });

            document.querySelectorAll('.admin-edit-shipping-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const orderId = e.target.dataset.orderId;
                    const order = orders.find(o => o.id === orderId);
                    if (order) {
                        editShippingOrderIdDisplay.textContent = order.id;
                        editShippingOrderHiddenId.value = order.id;
                        editOrderLocationInput.value = order.orderLocation || '';
                        editEstimatedDeliveryDateInput.value = order.estimatedDeliveryDate || '';
                        openModal(editShippingOrderModal);
                    }
                });
            });

            document.querySelectorAll('.pay-vat-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    if (!loggedInUser || !loggedInUser.id) {
                        showNotification('Vui lòng đăng nhập để thanh toán VAT.', 'info');
                        openModal(loginRegisterModal);
                        return;
                    }
                    const orderId = e.target.dataset.orderId;
                    const order = orders.find(o => o.id === orderId);
                    if (order) {
                        currentOrderForPayment = order;
                        displayPaymentVATModal(order);
                    }
                });
            });

            document.querySelectorAll('.add-warranty-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    if (!loggedInUser || !loggedInUser.id) {
                        showNotification('Vui lòng đăng nhập để mua gói bảo hành.', 'info');
                        openModal(loginRegisterModal);
                        return;
                    }
                    const orderId = e.target.dataset.orderId;
                    const order = orders.find(o => o.id === orderId);
                    if (order) {
                        currentOrderForWarranty = order;
                        displayPaymentWarrantyModal(order);
                    }
                });
            });

            document.querySelectorAll('.track-order-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const orderId = e.target.dataset.orderId;
                    const order = orders.find(o => o.id === orderId);
                    if (order) {
                        currentOrderForTracking = order;
                        displayOrderTrackingModal(order);
                    }
                });
            });

            document.querySelectorAll('.return-exchange-btn').forEach(button => {
                button.addEventListener('click', () => {
                    showNotification('Chức năng đổi/trả đang được phát triển.', 'info');
                });
            });
        }
    } catch (error) {
        console.error("Error rendering orders:", error);
        showNotification(`Lỗi khi tải đơn hàng: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

searchCreatedOrdersInput.addEventListener('input', debouncedRenderCreatedOrders);
clearSearchCreatedOrdersBtn.addEventListener('click', () => {
    searchCreatedOrdersInput.value = '';
    renderOrders('created');
});

searchShippingOrdersInput.addEventListener('input', debouncedRenderShippingOrders);
clearSearchShippingOrdersBtn.addEventListener('click', () => {
    searchShippingOrdersInput.value = '';
    renderOrders('shipping');
});

searchDeliveredOrdersInput.addEventListener('input', debouncedRenderDeliveredOrders);
clearSearchDeliveredOrdersBtn.addEventListener('click', () => {
    searchDeliveredOrdersInput.value = '';
    renderOrders('delivered');
});


async function updateOrderStatus(orderId, customerUserId, actionType) {
    showLoading();
    try {
        const adminOrderRef = doc(collection(db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        const adminOrderSnap = await getDoc(adminOrderRef);
        if (!adminOrderSnap.exists()) {
            showNotification('Không tìm thấy đơn hàng.', 'error');
            hideLoading();
            return;
        }
        const currentOrderData = adminOrderSnap.data();
        let newStatus = currentOrderData.status;
        let updates = { status: newStatus };

        if (actionType === 'approve_created' && newStatus === 'created') {
            newStatus = 'shipping';
            const today = new Date();
            today.setDate(today.getDate() + 5);
            updates.estimatedDeliveryDate = today.toISOString().split('T')[0];
            updates.status = newStatus;
        } else if (actionType === 'approve_shipping' && newStatus === 'shipping') {
            newStatus = 'delivered';
            updates.status = newStatus;
        } else {
            console.warn(`Invalid actionType or status mismatch: actionType=${actionType}, currentStatus=${newStatus}`);
            showNotification('Hành động không hợp lệ cho trạng thái đơn hàng hiện tại.', 'error');
            hideLoading();
            return;
        }

        const userOrderRef = doc(db, `artifacts/${appId}/users/${customerUserId}/orders`, orderId);
        await updateDoc(userOrderRef, updates);
        console.log(`Order ${orderId} status updated to ${newStatus} in user's collection.`);

        await updateDoc(adminOrderRef, updates);
        console.log(`Order ${orderId} status updated to ${newStatus} in admin collection.`);

        showNotification(`Đơn hàng #${orderId} đã được chuyển sang trạng thái "${newStatus}".`, 'success');
        renderOrders('created');
        renderOrders('shipping');
        renderOrders('delivered');
    } catch (error) {
        console.error("Error updating order status:", error);
        showNotification(`Lỗi cập nhật trạng thái đơn hàng: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function deleteOrder(orderId, customerUserId) {
    showLoading();
    try {
        const userOrderRef = doc(db, `artifacts/${appId}/users/${customerUserId}/orders`, orderId);
        await deleteDoc(userOrderRef);
        console.log(`Order ${orderId} deleted from user's collection.`);

        const adminOrderRef = doc(collection(db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        await deleteDoc(adminOrderRef);
        console.log(`Order ${orderId} deleted from admin collection.`);

        showNotification(`Đơn hàng #${orderId} đã được hủy thành công.`, 'success');
        renderOrders('created');
        renderOrders('shipping');
        renderOrders('delivered');
    } catch (error) {
        console.error("Error deleting order:", error);
        showNotification(`Lỗi khi hủy đơn hàng: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

editShippingOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Chờ admin kiểm duyệt', 'info');
        return;
    }
    showLoading();
    const orderId = editShippingOrderHiddenId.value;
    const newLocation = editOrderLocationInput.value.trim();
    const newEstimatedDate = editEstimatedDeliveryDateInput.value;

    try {
        const adminOrderRef = doc(collection(db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        const adminOrderSnap = await getDoc(adminOrderRef);
        if (!adminOrderSnap.exists()) {
            showNotification('Không tìm thấy đơn hàng để cập nhật.', 'error');
            hideLoading();
            return;
        }
        const orderData = adminOrderSnap.data();
        const customerUserId = orderData.userId;

        const userOrderRef = doc(db, `artifacts/${appId}/users/${customerUserId}/orders`, orderId);
        await updateDoc(userOrderRef, {
            orderLocation: newLocation,
            estimatedDeliveryDate: newEstimatedDate
        });
        console.log(`Shipping info for order ${orderId} updated in user's collection.`);

        await updateDoc(adminOrderRef, {
            orderLocation: newLocation,
            estimatedDeliveryDate: newEstimatedDate
        });
        console.log(`Shipping info for order ${orderId} updated in admin collection.`);

        showNotification('Cập nhật thông tin vận chuyển thành công!', 'success');
        closeModal(editShippingOrderModal);
        renderOrders('shipping');
    } catch (error) {
        console.error("Error updating shipping info:", error);
        showNotification(`Lỗi cập nhật thông tin vận chuyển: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
});

function renderProductManagementList() {
    productManagementList.innerHTML = '';
    if (shopDataCache.products.length === 0) {
        productManagementList.innerHTML = '<p class="text-gray-500 italic">Chưa có sản phẩm nào.</p>';
        return;
    }
    shopDataCache.products.forEach(product => {
        const productDiv = document.createElement('div');
        productDiv.className = 'flex items-center justify-between bg-gray-100 p-3 rounded-lg shadow-sm';
        productDiv.innerHTML = `
            <div class="flex items-center space-x-3">
                <img src="${product.image}" onerror="this.onerror=null;this.src='https://placehold.co/60x60/cccccc/333333?text=SP';" class="w-16 h-16 object-cover rounded-md">
                <div>
                    <p class="font-semibold text-gray-900">${product.name}</p>
                    <p class="text-sm text-gray-600">${formatCurrency(product.basePrice)}</p>
                    <p class="text-xs text-gray-500">Danh mục: ${product.category || 'Chưa phân loại'}</p>
                </div>
            </div>
            <div class="flex space-x-2">
                <button class="copy-product-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-product-id="${product.id}">Sao chép</button>
                <button class="edit-product-btn bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-product-id="${product.id}">Sửa</button>
                <button class="delete-product-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-product-id="${product.id}">Xóa</button>
            </div>
        `;
        productManagementList.appendChild(productDiv);
    });

    document.querySelectorAll('.copy-product-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!loggedInUser || !loggedInUser.isAdmin) {
                showNotification('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const productId = e.target.dataset.productId;
            copyProduct(productId);
        });
    });

    document.querySelectorAll('.edit-product-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!loggedInUser || !loggedInUser.isAdmin) {
                showNotification('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const productId = e.target.dataset.productId;
            editProduct(productId);
        });
    });

    document.querySelectorAll('.delete-product-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!loggedInUser || !loggedInUser.isAdmin) {
                showNotification('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const productId = e.target.dataset.productId;
            if (confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) {
                await deleteProduct(productId);
            }
        });
    });
}

function resetAddEditProductForm() {
    addEditProductTitle.textContent = 'Thêm Mặt Hàng Mới';
    editProductIdInput.value = '';
    newProductNameInput.value = '';
    newProductBasePriceInput.value = '';
    newProductImageInput.value = '';
    newProductDescriptionInput.value = '';
    newProductReviewsInput.value = '0';
    newProductCategoryInput.value = ''; // Reset category
    colorOptionsContainer.innerHTML = '';
    storageOptionsContainer.innerHTML = '';
    variantsContainer.innerHTML = '';
    submitProductBtn.textContent = 'Thêm Sản Phẩm';
    cancelEditBtn.classList.add('hidden');
}

function copyProduct(productId) {
    const product = shopDataCache.products.find(p => p.id === productId);
    if (!product) {
        showNotification('Không tìm thấy sản phẩm để sao chép.', 'error');
        return;
    }

    const copiedProduct = JSON.parse(JSON.stringify(product));
    copiedProduct.id = generateId();
    copiedProduct.name = `Bản sao của ${product.name}`;

    copiedProduct.variants.forEach(variant => {
        variant.sold = 0;
    });

    shopDataCache.products.push(copiedProduct);
    showNotification('Đã sao chép sản phẩm. Vui lòng chỉnh sửa và lưu.', 'success');
    editProduct(copiedProduct.id);
}

addEditProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Chờ admin kiểm duyệt', 'info');
        return;
    }
    showLoading();

    const productId = editProductIdInput.value;
    const name = newProductNameInput.value.trim();
    const basePrice = parseFloat(newProductBasePriceInput.value);
    const image = newProductImageInput.value.trim();
    const description = newProductDescriptionInput.value.trim();
    const reviewsCount = parseInt(newProductReviewsInput.value);
    const category = newProductCategoryInput.value.trim(); // Get category

    const colors = [];
    colorOptionsContainer.querySelectorAll('.color-option-item').forEach(item => {
        const name = item.querySelector('input[placeholder="Tên màu"]').value.trim();
        const priceImpact = parseFloat(item.querySelector('input[placeholder="Giá tác động"]').value) || 0;
        const display_image = item.querySelector('input[placeholder="URL ảnh hiển thị"]').value.trim();
        if (name) colors.push({ name, priceImpact, display_image });
    });

    const storages = [];
    storageOptionsContainer.querySelectorAll('.storage-option-item').forEach(item => {
        const name = item.querySelector('input[placeholder="Tên dung lượng"]').value.trim();
        const priceImpact = parseFloat(item.querySelector('input[placeholder="Giá tác động"]').value) || 0;
        if (name) storages.push({ name, priceImpact });
    });

    const variants = [];
    variantsContainer.querySelectorAll('.variant-item').forEach(item => {
        const color = item.querySelector('select[data-type="color-select"]').value;
        const storage = item.querySelector('select[data-type="storage-select"]').value;
        const quantity = parseInt(item.querySelector('input[placeholder="Số lượng"]').value) || 0;
        const sold = parseInt(item.querySelector('input[placeholder="Số lượng đã bán"]').value) || 0;
        const priceImpact = parseFloat(item.querySelector('input[placeholder="Giá tác động"]').value) || 0;
        if (color && storage) variants.push({ color, storage, quantity, priceImpact, sold });
    });

    const newProduct = {
        name,
        basePrice,
        image,
        description,
        reviewsCount,
        category, // Save category
        colors,
        storages,
        variants
    };

    if (productId) {
        const index = shopDataCache.products.findIndex(p => p.id === productId);
        if (index > -1) {
            shopDataCache.products[index] = { ...shopDataCache.products[index], ...newProduct };
        }
        showNotification('Sản phẩm đã được cập nhật!', 'success');
        console.log(`Product ${productId} updated.`);
    } else {
        newProduct.id = generateId();
        shopDataCache.products.push(newProduct);
        showNotification('Sản phẩm đã được thêm!', 'success');
        console.log("New product added:", newProduct);
    }
    await saveShopData();
    resetAddEditProductForm();
    hideLoading();
});

async function editProduct(productId) {
    const product = shopDataCache.products.find(p => p.id === productId);
    if (!product) {
        showNotification('Không tìm thấy sản phẩm.', 'error');
        return;
    }

    addEditProductTitle.textContent = 'Chỉnh Sửa Sản Phẩm';
    editProductIdInput.value = product.id;
    newProductNameInput.value = product.name;
    newProductBasePriceInput.value = product.basePrice;
    newProductImageInput.value = product.image;
    newProductDescriptionInput.value = product.description;
    newProductReviewsInput.value = product.reviewsCount;
    newProductCategoryInput.value = product.category || ''; // Populate category

    colorOptionsContainer.innerHTML = '';
    product.colors.forEach(color => addColorOption(color.name, color.priceImpact, color.display_image));

    storageOptionsContainer.innerHTML = '';
    product.storages.forEach(storage => addStorageOption(storage.name, storage.priceImpact));

    variantsContainer.innerHTML = '';
    product.variants.forEach(variant => addVariant(variant.color, variant.storage, variant.quantity, variant.priceImpact, variant.sold));

    submitProductBtn.textContent = 'Lưu Thay Đổi';
    cancelEditBtn.classList.remove('hidden');
}

cancelEditBtn.addEventListener('click', resetAddEditProductForm);

async function deleteProduct(productId) {
    showLoading();
    try {
        shopDataCache.products = shopDataCache.products.filter(p => p.id !== productId);
        await saveShopData();
        showNotification('Sản phẩm đã được xóa!', 'success');
        console.log(`Product ${productId} deleted.`);
    } catch (error) {
        console.error("Error deleting product:", error);
        showNotification(`Lỗi khi xóa sản phẩm: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

addColorOptionBtn.addEventListener('click', () => addColorOption('', 0, ''));
addStorageOptionBtn.addEventListener('click', () => addStorageOption('', 0));
addVariantBtn.addEventListener('click', () => addVariant('', '', 0, 0, 0));

function addVariant(color = '', storage = '', quantity = 0, priceImpact = 0, sold = 0) {
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2 variant-item';
    const currentColors = Array.from(colorOptionsContainer.querySelectorAll('input[placeholder="Tên màu"]')).map(input => input.value.trim()).filter(Boolean);
    const currentStorages = Array.from(storageOptionsContainer.querySelectorAll('input[placeholder="Tên dung lượng"]')).map(input => input.value.trim()).filter(Boolean);

    const colorSelectHtml = `<select data-type="color-select" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1">
        <option value="">Chọn màu</option>
        ${currentColors.map(c => `<option value="${c}" ${c === color ? 'selected' : ''}>${c}</option>`).join('')}
    </select>`;
    const storageSelectHtml = `<select data-type="storage-select" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1">
        <option value="">Chọn dung lượng</option>
        ${currentStorages.map(s => `<option value="${s}" ${s === storage ? 'selected' : ''}>${s}</option>`).join('')}
    </select>`;

    div.innerHTML = `
        ${colorSelectHtml}
        ${storageSelectHtml}
        <input type="number" placeholder="Số lượng" value="${quantity}" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 w-20">
        <input type="number" placeholder="Số lượng đã bán" value="${sold}" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 w-20">
        <input type="number" placeholder="Giá tác động" value="${priceImpact}" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 w-20">
        <button type="button" class="remove-option-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg"><i class="fas fa-minus"></i></button>
    `;
    variantsContainer.appendChild(div);
    div.querySelector('.remove-option-btn').addEventListener('click', () => div.remove());
}

function addColorOption(name = '', priceImpact = 0, display_image = '') {
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2 color-option-item';
    div.innerHTML = `
        <input type="text" placeholder="Tên màu" value="${name}" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1">
        <input type="number" placeholder="Giá tác động" value="${priceImpact}" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 w-20">
        <input type="url" placeholder="URL ảnh hiển thị" value="${display_image}" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1">
        <button type="button" class="remove-option-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg"><i class="fas fa-minus"></i></button>
    `;
    colorOptionsContainer.appendChild(div);
    div.querySelector('.remove-option-btn').addEventListener('click', () => div.remove());
}

function addStorageOption(name = '', priceImpact = 0) {
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-2 storage-option-item';
    div.innerHTML = `
        <input type="text" placeholder="Tên dung lượng" value="${name}" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 w-20">
        <input type="number" placeholder="Giá tác động" value="${priceImpact}" class="shadow appearance-none border rounded-lg py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 w-20">
        <button type="button" class="remove-option-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg"><i class="fas fa-minus"></i></button>
    `;
    storageOptionsContainer.appendChild(div);
    div.querySelector('.remove-option-btn').addEventListener('click', () => div.remove());
}

async function renderVouchersList() {
    currentVouchersList.innerHTML = '';
    const vouchers = Object.entries(shopDataCache.vouchers);
    if (vouchers.length === 0) {
        currentVouchersList.innerHTML = '<p class="text-gray-500 italic">Chưa có voucher nào.</p>';
        return;
    }

    const userVouchers = vouchers.filter(([, voucherData]) => !voucherData.isAdminVoucher);
    const adminVouchers = vouchers.filter(([, voucherData]) => voucherData.isAdminVoucher);

    const userVoucherSection = document.createElement('div');
    userVoucherSection.innerHTML = `
        <h4 class="text-xl font-semibold mb-3 text-gray-800">Voucher Người Dùng</h4>
        <div id="user-vouchers-sublist" class="space-y-2"></div>
    `;
    currentVouchersList.appendChild(userVoucherSection);
    const userVouchersSublist = userVoucherSection.querySelector('#user-vouchers-sublist');

    if (userVouchers.length === 0) {
        userVouchersSublist.innerHTML = '<p class="text-gray-500 italic">Chưa có voucher người dùng nào.</p>';
    } else {
        userVouchers.forEach(([code, voucherData]) => {
            const voucherDiv = document.createElement('div');
            voucherDiv.className = 'flex items-center justify-between bg-gray-100 p-3 rounded-lg shadow-sm';
            const expiryDate = new Date(voucherData.expiry);
            const now = new Date();
            const isExpired = expiryDate <= now;
            const expiryText = isExpired ? 'Đã hết hạn' : `Hết hạn: ${expiryDate.toLocaleString('vi-VN')}`;
            const expiryColorClass = isExpired ? 'text-red-500' : 'text-green-600';

            voucherDiv.innerHTML = `
                <p class="font-semibold text-gray-900">${code}: ${voucherData.displayValue} <span class="${expiryColorClass}">(${expiryText})</span></p>
                <div class="flex space-x-2">
                    <button class="copy-voucher-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded-lg transition-all duration-200" data-voucher-code="${code}">Sao chép</button>
                    <button class="delete-voucher-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-lg transition-all duration-200" data-voucher-code="${code}">Xóa</button>
                </div>
            `;
            userVouchersSublist.appendChild(voucherDiv);
        });
    }

    const adminVoucherSection = document.createElement('div');
    adminVoucherSection.classList.add('mt-6');
    adminVoucherSection.innerHTML = `
        <h4 class="text-xl font-semibold mb-3 text-gray-800">Voucher Admin</h4>
        <div id="admin-vouchers-sublist" class="space-y-2"></div>
    `;
    currentVouchersList.appendChild(adminVoucherSection);
    const adminVouchersSublist = adminVoucherSection.querySelector('#admin-vouchers-sublist');

    if (adminVouchers.length === 0) {
        adminVouchersSublist.innerHTML = '<p class="text-gray-500 italic">Chưa có voucher admin nào.</p>';
    } else {
        adminVouchers.forEach(([code, voucherData]) => {
            const voucherDiv = document.createElement('div');
            voucherDiv.className = 'flex items-center justify-between bg-gray-100 p-3 rounded-lg shadow-sm';
            const expiryDate = new Date(voucherData.expiry);
            const now = new Date();
            const isExpired = expiryDate <= now;
            const expiryText = isExpired ? 'Đã hết hạn' : `Hết hạn: ${expiryDate.toLocaleString('vi-VN')}`;
            const expiryColorClass = isExpired ? 'text-red-500' : 'text-green-600';

            voucherDiv.innerHTML = `
                <p class="font-semibold text-gray-900">${code}: ${voucherData.displayValue} <span class="${expiryColorClass}">(${expiryText})</span></p>
                <div class="flex space-x-2">
                    <button class="copy-voucher-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-2 rounded-lg transition-all duration-200" data-voucher-code="${code}">Sao chép</button>
                    <button class="delete-voucher-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded-lg transition-all duration-200" data-voucher-code="${code}">Xóa</button>
                </div>
            `;
            adminVouchersSublist.appendChild(voucherDiv);
        });
    }


    document.querySelectorAll('.delete-voucher-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!loggedInUser || !loggedInUser.isAdmin) {
                showNotification('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const voucherCode = e.target.dataset.voucherCode;
            if (confirm('Bạn có chắc chắn muốn xóa voucher này?')) {
                await deleteVoucher(voucherCode);
            }
        });
    });

    document.querySelectorAll('.copy-voucher-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const voucherCode = e.target.dataset.voucherCode;
            navigator.clipboard.writeText(voucherCode).then(() => {
                showNotification(`Đã sao chép mã voucher "${voucherCode}" vào clipboard!`, 'success');
            }).catch(err => {
                console.error('Không thể sao chép văn bản: ', err);
                showNotification('Không thể sao chép mã voucher. Vui lòng thử lại.', 'error');
            });
        });
    });
}

addVoucherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Chờ admin kiểm duyệt', 'info');
        return;
    }
    showLoading();

    const initialCode = newVoucherCodeInput.value.trim().toUpperCase();
    const quantity = parseInt(newVoucherQuantityInput.value);
    const codeLength = parseInt(newVoucherCodeLengthInput.value);
    let valueInput = newVoucherValueInput.value.trim();
    const expiryInput = newVoucherExpiryInput.value.trim();

    if (isNaN(quantity) || quantity <= 0) {
        showNotification('Số lượng voucher không hợp lệ.', 'error');
        hideLoading();
        return;
    }
    if (initialCode === '' && (isNaN(codeLength) || codeLength < 4 || codeLength > 16)) {
        showNotification('Độ dài mã voucher ngẫu nhiên không hợp lệ (từ 4 đến 16).', 'error');
        hideLoading();
        return;
    }

    let voucherValue;
    let voucherType;
    let displayValue;

    if (valueInput.toLowerCase() === 'freeship') {
        voucherValue = 'freeship';
        voucherType = 'freeship';
        displayValue = 'Miễn phí vận chuyển';
    } else {
        voucherValue = parseFloat(valueInput);
        if (isNaN(voucherValue)) {
            showNotification('Giá trị voucher không hợp lệ.', 'error');
            hideLoading();
            return;
        }
        if (voucherValue < 1) {
            voucherType = 'percentage';
            displayValue = `${voucherValue * 100}%`;
        } else {
            voucherType = 'fixed';
            displayValue = formatCurrency(voucherValue);
        }
    }

    if (!expiryInput) {
        showNotification('Vui lòng nhập thời gian hết hạn cho voucher.', 'error');
        hideLoading();
        return;
    }
    const expiryDate = new Date(expiryInput);
    if (isNaN(expiryDate.getTime())) {
        showNotification('Định dạng thời gian hết hạn không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD HH:MM:SS.', 'error');
        hideLoading();
        return;
    }

    let vouchersAddedCount = 0;
    for (let i = 0; i < quantity; i++) {
        let codeToAdd = initialCode;
        if (initialCode === '') {
            codeToAdd = generateUniqueVoucherCode(codeLength);
        } else if (shopDataCache.vouchers[initialCode]) {
            showNotification(`Mã voucher "${initialCode}" đã tồn tại. Không thể thêm.`, 'error');
            break;
        }

        shopDataCache.vouchers[codeToAdd] = {
            value: voucherValue,
            type: voucherType,
            expiry: expiryDate.toISOString(),
            displayValue: displayValue,
            isAdminVoucher: false
        };
        vouchersAddedCount++;
        if (initialCode !== '') break;
    }

    if (vouchersAddedCount > 0) {
        await saveShopData();
        showNotification(`Đã thêm thành công ${vouchersAddedCount} voucher!`, 'success');
        newVoucherCodeInput.value = '';
        newVoucherQuantityInput.value = '1';
        newVoucherCodeLengthInput.value = '8';
        newVoucherValueInput.value = '';
        newVoucherExpiryInput.value = '';
    } else {
        showNotification('Không có voucher nào được thêm.', 'info');
    }
    hideLoading();
});

addAdminVoucherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Bạn không có quyền thêm voucher Admin.', 'info');
        return;
    }
    showLoading();

    const initialCode = newAdminVoucherCodeInput.value.trim().toUpperCase();
    const quantity = parseInt(newAdminVoucherQuantityInput.value);
    const codeLength = parseInt(newAdminVoucherCodeLengthInput.value);
    let valueInput = newAdminVoucherValueInput.value.trim();
    const expiryInput = newAdminVoucherExpiryInput.value.trim();

    if (isNaN(quantity) || quantity <= 0) {
        showNotification('Số lượng voucher không hợp lệ.', 'error');
        hideLoading();
        return;
    }
    if (initialCode === '' && (isNaN(codeLength) || codeLength < 4 || codeLength > 16)) {
        showNotification('Độ dài mã voucher admin ngẫu nhiên không hợp lệ (từ 4 đến 16).', 'error');
        hideLoading();
        return;
    }

    let voucherValue;
    let voucherType;
    let displayValue;

    if (valueInput.toLowerCase() === 'freeship') {
        voucherValue = 'freeship';
        voucherType = 'freeship';
        displayValue = 'Miễn phí vận chuyển';
    } else {
        voucherValue = parseFloat(valueInput);
        if (isNaN(voucherValue)) {
            showNotification('Giá trị voucher không hợp lệ.', 'error');
            hideLoading();
            return;
        }
        if (voucherValue < 1) {
            voucherType = 'percentage';
            displayValue = `${voucherValue * 100}%`;
        } else {
            voucherType = 'fixed';
            displayValue = formatCurrency(voucherValue);
        }
    }

    if (!expiryInput) {
        showNotification('Vui lòng nhập thời gian hết hạn cho voucher Admin.', 'error');
        hideLoading();
        return;
    }
    const expiryDate = new Date(expiryInput);
    if (isNaN(expiryDate.getTime())) {
        showNotification('Định dạng thời gian hết hạn không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD HH:MM:SS.', 'error');
        hideLoading();
        return;
    }

    let vouchersAddedCount = 0;
    for (let i = 0; i < quantity; i++) {
        let codeToAdd = initialCode;
        if (initialCode === '') {
            codeToAdd = generateUniqueVoucherCode(codeLength);
        } else if (shopDataCache.vouchers[initialCode]) {
            showNotification(`Mã voucher admin "${initialCode}" đã tồn tại. Không thể thêm.`, 'error');
            break;
        }

        shopDataCache.vouchers[codeToAdd] = {
            value: voucherValue,
            type: voucherType,
            expiry: expiryDate.toISOString(),
            displayValue: displayValue,
            isAdminVoucher: true
        };
        vouchersAddedCount++;
        if (initialCode !== '') break;
    }

    if (vouchersAddedCount > 0) {
        await saveShopData();
        showNotification(`Đã thêm thành công ${vouchersAddedCount} voucher Admin!`, 'success');
        newAdminVoucherCodeInput.value = '';
        newAdminVoucherQuantityInput.value = '1';
        newAdminVoucherCodeLengthInput.value = '8';
        newAdminVoucherValueInput.value = '';
        newAdminVoucherExpiryInput.value = '';
    } else {
        showNotification('Không có voucher Admin nào được thêm.', 'info');
    }
    hideLoading();
});


async function deleteVoucher(code) {
    showLoading();
    try {
        delete shopDataCache.vouchers[code];
        await saveShopData();
        console.log(`Voucher ${code} deleted.`);
        showNotification(`Voucher ${code} đã được xóa!`, 'success');
    } catch (error) {
        console.error("Error deleting voucher:", error);
        showNotification(`Lỗi khi xóa voucher: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function renderWarrantyPackagesList() {
    warrantyPackagesSelection.innerHTML = '';
    currentWarrantyPackagesList.innerHTML = '';
    if (shopDataCache.warrantyPackages.length === 0) {
        currentWarrantyPackagesList.innerHTML = '<p class="text-gray-500 italic">Chưa có gói bảo hành nào được cấu hình.</p>';
        warrantyPackagesSelection.innerHTML = '<p class="text-gray-500 italic">Chưa có gói bảo hành nào để chọn.</p>';
        return;
    }

    shopDataCache.warrantyPackages.forEach(pkg => {
        const packageDiv = document.createElement('div');
        packageDiv.className = 'flex items-center justify-between bg-gray-100 p-3 rounded-lg shadow-sm';
        packageDiv.innerHTML = `
            <div>
                <p class="font-semibold text-gray-900">${pkg.name}</p>
                <p class="text-sm text-gray-600">Giá: ${formatCurrency(pkg.price)} - Giảm: ${pkg.discount}%</p>
            </div>
            <div class="flex space-x-2">
                <button class="edit-warranty-package-btn bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-package-id="${pkg.id}">Sửa</button>
                <button class="delete-warranty-package-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-package-id="${pkg.id}">Xóa</button>
            </div>
        `;
        currentWarrantyPackagesList.appendChild(packageDiv);
    });

    shopDataCache.warrantyPackages.forEach(pkg => {
        const packageCard = document.createElement('div');
        packageCard.className = 'warranty-package-card cursor-pointer';
        packageCard.dataset.packageId = pkg.id;
        packageCard.innerHTML = `
            <h4 class="font-semibold text-lg text-gray-900">${pkg.name}</h4>
            <p class="text-gray-700">Giá gốc: <span class="font-bold">${formatCurrency(pkg.price)}</span></p>
            ${pkg.discount > 0 ? `<p class="text-green-600">Giảm giá: ${pkg.discount}%</p>` : ''}
            <p class="text-xl font-bold text-blue-700">Giá cuối: ${formatCurrency(pkg.price - (pkg.price * pkg.discount / 100))}</p>
        `;
        warrantyPackagesSelection.appendChild(packageCard);

        packageCard.addEventListener('click', () => {
            document.querySelectorAll('.warranty-package-card').forEach(card => {
                card.classList.remove('selected-package');
            });
            packageCard.classList.add('selected-package');
            selectedWarrantyPackage = pkg;
            const finalPrice = pkg.price - (pkg.price * pkg.discount / 100);
            warrantyPaymentTotal.textContent = formatCurrency(finalPrice);
            confirmWarrantyPaymentBtn.disabled = false;
            confirmWarrantyPaymentBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
    });


    document.querySelectorAll('.edit-warranty-package-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!loggedInUser || !loggedInUser.isAdmin) {
                showNotification('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const packageId = e.target.dataset.packageId;
            editWarrantyPackage(packageId);
        });
    });

    document.querySelectorAll('.delete-warranty-package-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!loggedInUser || !loggedInUser.isAdmin) {
                showNotification('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const packageId = e.target.dataset.packageId;
            if (confirm('Bạn có chắc chắn muốn xóa gói bảo hành này?')) {
                await deleteWarrantyPackage(packageId);
            }
        });
    });
}

function resetAddEditWarrantyPackageForm() {
    editWarrantyPackageIdInput.value = '';
    newWarrantyPackageNameInput.value = '';
    newWarrantyPackagePriceInput.value = '';
    newWarrantyPackageDiscountInput.value = '0';
    submitWarrantyPackageBtn.textContent = 'Thêm Gói Bảo Hành';
    cancelEditWarrantyPackageBtn.classList.add('hidden');
}

addEditWarrantyPackageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Chờ admin kiểm duyệt', 'info');
        return;
    }
    showLoading();

    const packageId = editWarrantyPackageIdInput.value;
    const name = newWarrantyPackageNameInput.value.trim();
    const price = parseFloat(newWarrantyPackagePriceInput.value);
    const discount = parseFloat(newWarrantyPackageDiscountInput.value);

    const newPackage = {
        id: packageId || generateId(),
        name,
        price,
        discount
    };

    if (packageId) {
        const index = shopDataCache.warrantyPackages.findIndex(p => p.id === packageId);
        if (index > -1) {
            shopDataCache.warrantyPackages[index] = newPackage;
        }
        showNotification('Gói bảo hành đã được cập nhật!', 'success');
        console.log(`Warranty package ${packageId} updated.`);
    } else {
        shopDataCache.warrantyPackages.push(newPackage);
        showNotification('Gói bảo hành đã được thêm!', 'success');
        console.log("New warranty package added:", newPackage);
    }
    await saveShopData();
    renderWarrantyPackagesList();
    resetAddEditWarrantyPackageForm();
    hideLoading();
});

function editWarrantyPackage(packageId) {
    const pkg = shopDataCache.warrantyPackages.find(p => p.id === packageId);
    if (!pkg) {
        showNotification('Không tìm thấy gói bảo hành.', 'error');
        return;
    }
    editWarrantyPackageIdInput.value = pkg.id;
    newWarrantyPackageNameInput.value = pkg.name;
    newWarrantyPackagePriceInput.value = pkg.price;
    newWarrantyPackageDiscountInput.value = pkg.discount;
    submitWarrantyPackageBtn.textContent = 'Lưu Thay Đổi';
    cancelEditWarrantyPackageBtn.classList.remove('hidden');
}

cancelEditWarrantyPackageBtn.addEventListener('click', resetAddEditWarrantyPackageForm);

async function deleteWarrantyPackage(packageId) {
    showLoading();
    try {
        shopDataCache.warrantyPackages = shopDataCache.warrantyPackages.filter(p => p.id !== packageId);
        await saveShopData();
        renderWarrantyPackagesList();
        console.log(`Warranty package ${packageId} deleted.`);
    }
    catch (error) {
        console.error("Error deleting warranty package:", error);
        showNotification(`Lỗi khi xóa gói bảo hành: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function generateShopReport() {
    showLoading();
    let allOrders = [];
    try {
        if (loggedInUser && loggedInUser.isAdmin) {
            const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/adminOrders`));
            allOrders = querySnapshot.docs.map(doc => doc.data());
            console.log("Admin fetched all orders for report:", allOrders);
        } else if (loggedInUser && loggedInUser.id) {
            const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/users/${loggedInUser.id}/orders`));
            allOrders = querySnapshot.docs.map(doc => doc.data());
            console.log(`User ${loggedInUser.id} fetched orders for report:`, allOrders);
        } else {
            totalRevenueDisplay.textContent = formatCurrency(0);
            totalOrdersDisplay.textContent = 0;
            topSellingProductsList.innerHTML = '<li class="italic text-gray-500">Vui lòng đăng nhập để xem báo cáo.</li>';
            hideLoading();
            return;
        }

        const startDate = reportStartDateInput.value ? new Date(reportStartDateInput.value) : null;
        const endDate = reportEndDateInput.value ? new Date(reportEndDateInput.value) : null;

        const filteredOrders = allOrders.filter(order => {
            const orderDate = new Date(order.orderDate);
            return (!startDate || orderDate >= startDate) && (!endDate || orderDate <= endDate);
        });

        let totalRevenue = 0;
        const productSales = {};

        filteredOrders.forEach(order => {
            totalRevenue += order.totalAmount;
            order.items.forEach(item => {
                const productName = item.productName;
                productSales[productName] = (productSales[productName] || 0) + item.quantity;
            });
        });

        totalRevenueDisplay.textContent = formatCurrency(totalRevenue);
        totalOrdersDisplay.textContent = filteredOrders.length;

        const sortedProducts = Object.entries(productSales).sort(([, a], [, b]) => b - a);
        topSellingProductsList.innerHTML = '';
        if (sortedProducts.length === 0) {
            topSellingProductsList.innerHTML = '<li class="italic text-gray-500">Chưa có dữ liệu.</li>';
        } else {
            sortedProducts.slice(0, 5).forEach(([productName, quantity]) => {
                const li = document.createElement('li');
                li.textContent = `${productName}: ${quantity} sản phẩm`;
                topSellingProductsList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error generating shop report:", error);
        showNotification(`Lỗi khi tạo báo cáo: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

generateReportBtn.addEventListener('click', generateShopReport);

function displayPaymentVATModal(order) {
    qrCodeDisplay.src = shopDataCache.bankDetails.qrCodeImage || 'https://placehold.co/200x200/cccccc/333333?text=QR+Code';
    bankNameDisplay.textContent = shopDataCache.bankDetails.bankName || 'N/A';
    accountNumberDisplay.textContent = shopDataCache.bankDetails.accountNumber || 'N/A';
    accountHolderDisplay.textContent = shopDataCache.bankDetails.accountHolder || 'N/A';

    vatBaseAmountDisplay.textContent = formatCurrency(order.totalOriginalProductPrice);

    const shopSupportAmount = order.totalOriginalProductPrice * 0.08;
    if (shopSupportVatDisplay) {
        shopSupportVatDisplay.textContent = formatCurrency(shopSupportAmount);
    }

    const totalVATOriginalAmount = order.totalOriginalProductPrice * 0.10;
    if (totalVatOriginalDisplay) {
        totalVatOriginalDisplay.textContent = formatCurrency(totalVATOriginalAmount);
    }

    const customerPaysAmount = order.totalOriginalProductPrice * 0.02;
    paymentModalVATTotal.textContent = formatCurrency(customerPaysAmount);

    paymentAmountInput.value = customerPaysAmount;
    amountPaidDisplay.textContent = formatCurrency(0);
    remainingPaymentDisplay.textContent = formatCurrency(customerPaysAmount);

    paymentAmountInput.disabled = true;

    paymentAmountInput.oninput = () => {
        const paidAmount = parseFloat(paymentAmountInput.value) || 0;
        const remaining = customerPaysAmount - paidAmount;
        amountPaidDisplay.textContent = formatCurrency(paidAmount);
        remainingPaymentDisplay.textContent = formatCurrency(remaining);
        remainingPaymentDisplay.style.color = remaining <= 0 ? '#28a745' : '#e53e3e';
    };

    if (order.vatPaymentStatus === 'pending_admin' || order.vatPaymentStatus === 'paid') {
        confirmPaymentBtn.disabled = true;
        confirmPaymentBtn.textContent = 'Đang chờ xác nhận...';
        confirmPaymentBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        confirmPaymentBtn.disabled = false;
        confirmPaymentBtn.textContent = 'Thanh Toán';
        confirmPaymentBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    if (loggedInUser && loggedInUser.isAdmin) {
        confirmPaymentBtn.classList.add('hidden');
        adminConfirmVatPaymentBtn.classList.remove('hidden');
    } else {
        confirmPaymentBtn.classList.remove('hidden');
        adminConfirmVatPaymentBtn.classList.add('hidden');
    }

    openModal(paymentVATModal);
}

confirmPaymentBtn.addEventListener('click', async () => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để thanh toán.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    if (loggedInUser && loggedInUser.isAdmin) {
        showNotification('Admin không cần thực hiện thanh toán này, vui lòng dùng nút "Admin Xác Nhận".', 'info');
        return;
    }
    showLoading();
    try {
        const orderId = currentOrderForPayment.id;
        const orderRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/orders`, orderId);
        await updateDoc(orderRef, { vatPaymentStatus: 'pending_admin' });
        console.log(`VAT payment for order ${orderId} set to pending_admin for user.`);

        const adminOrderRef = doc(collection(db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        const adminOrderSnap = await getDoc(adminOrderRef);
        if (adminOrderSnap.exists()) {
            await updateDoc(adminOrderRef, { vatPaymentStatus: 'pending_admin' });
            console.log(`VAT payment for order ${orderId} set to pending_admin for admin.`);
        }

        showNotification('Yêu cầu thanh toán VAT của bạn đang chờ admin xác nhận!', 'info');
        closeModal(paymentVATModal);
        renderOrders(currentOrderForPayment.status);
    } catch (error) {
        console.error("Error confirming VAT payment:", error);
        showNotification(`Lỗi khi xác nhận thanh toán VAT: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
});

adminConfirmVatPaymentBtn.addEventListener('click', async () => {
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Bạn không có quyền xác nhận thanh toán này.', 'error');
        return;
    }
    showLoading();
    try {
        const orderId = currentOrderForPayment.id;
        const orderRef = doc(db, `artifacts/${appId}/users/${currentOrderForPayment.userId}/orders`, orderId);
        await updateDoc(orderRef, { vatPaymentStatus: 'paid' });
        console.log(`VAT payment for order ${orderId} set to paid for user.`);

        const adminOrderRef = doc(collection(db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        await updateDoc(adminOrderRef, { vatPaymentStatus: 'paid' });
        console.log(`VAT payment for order ${orderId} set to paid for admin.`);

        showNotification(`Đã xác nhận thanh toán VAT cho đơn hàng #${orderId}.`, 'success');
        closeModal(paymentVATModal);
        renderOrders(currentOrderForPayment.status);
    } catch (error) {
        console.error("Error admin confirming VAT payment:", error);
        showNotification(`Lỗi khi admin xác nhận thanh toán VAT: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
});

function displayPaymentWarrantyModal(order) {
    selectedWarrantyPackage = null;
    warrantyPaymentTotal.textContent = formatCurrency(0);
    confirmWarrantyPaymentBtn.disabled = true;
    confirmWarrantyPaymentBtn.classList.add('opacity-50', 'cursor-not-allowed');

    document.querySelectorAll('.warranty-package-card').forEach(card => {
        card.classList.remove('selected-package');
    });

    qrCodeDisplayWarranty.src = shopDataCache.bankDetails.qrCodeImage || 'https://placehold.co/200x200/cccccc/333333?text=QR+Code';
    bankNameDisplayWarranty.textContent = shopDataCache.bankDetails.bankName || 'N/A';
    accountNumberDisplayWarranty.textContent = shopDataCache.bankDetails.accountNumber || 'N/A';
    accountHolderDisplayWarranty.textContent = shopDataCache.bankDetails.accountHolder || 'N/A';

    if (loggedInUser && loggedInUser.isAdmin) {
        confirmWarrantyPaymentBtn.classList.add('hidden');
        adminConfirmWarrantyBtn.classList.remove('hidden');
    } else {
        confirmWarrantyPaymentBtn.classList.remove('hidden');
        adminConfirmWarrantyBtn.classList.add('hidden');
    }

    if (order.warrantyPaymentStatus === 'paid' || order.warrantyPaymentStatus === 'pending_admin') {
        confirmWarrantyPaymentBtn.disabled = true;
        confirmWarrantyPaymentBtn.textContent = 'Đã mua gói bảo hành';
        confirmWarrantyPaymentBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        confirmWarrantyPaymentBtn.disabled = false;
        confirmWarrantyPaymentBtn.textContent = 'Xác Nhận Thanh Toán';
        confirmWarrantyPaymentBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    renderWarrantyPackagesList();

    openModal(paymentWarrantyModal);
}

confirmWarrantyPaymentBtn.addEventListener('click', async () => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để mua gói bảo hành.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    if (loggedInUser.isAdmin) {
        showNotification('Admin không cần thực hiện thanh toán này, vui lòng dùng nút "Admin Xác Nhận".', 'info');
        return;
    }
    if (!selectedWarrantyPackage) {
        showNotification('Vui lòng chọn một gói bảo hành.', 'error');
        return;
    }

    showLoading();
    try {
        const orderId = currentOrderForWarranty.id;
        const orderRefUser = doc(db, `artifacts/${appId}/users/${loggedInUser.id}/orders`, orderId);
        const orderRefAdmin = doc(collection(db, `artifacts/${appId}/public/data/adminOrders`), orderId);

        await updateDoc(orderRefUser, {
            warrantyPackage: selectedWarrantyPackage,
            warrantyPaymentStatus: 'pending_admin'
        });
        console.log(`Warranty payment for order ${orderId} set to pending_admin for user.`);

        await updateDoc(orderRefAdmin, {
            warrantyPackage: selectedWarrantyPackage,
            warrantyPaymentStatus: 'pending_admin'
        });
        console.log(`Warranty payment for order ${orderId} set to pending_admin for admin.`);

        showNotification('Yêu cầu mua gói bảo hành của bạn đang chờ admin xác nhận!', 'info');
        closeModal(paymentWarrantyModal);
        renderOrders(currentOrderForWarranty.status);
    } catch (error) {
        console.error("Error confirming warranty payment:", error);
        showNotification(`Lỗi khi xác nhận mua gói bảo hành: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
});

adminConfirmWarrantyBtn.addEventListener('click', async () => {
    if (!loggedInUser || !loggedInUser.isAdmin) {
        showNotification('Bạn không có quyền xác nhận thanh toán này.', 'error');
        return;
    }
    if (!currentOrderForWarranty) {
        showNotification('Không có đơn hàng nào được chọn để xác nhận bảo hành.', 'error');
        return;
    }

    showLoading();
    try {
        const orderId = currentOrderForWarranty.id;
        const customerUserId = currentOrderForWarranty.userId;
        const orderRefUser = doc(db, `artifacts/${appId}/users/${customerUserId}/orders`, orderId);
        await updateDoc(orderRefUser, { warrantyPaymentStatus: 'paid' });
        console.log(`Warranty payment for order ${orderId} set to paid for user.`);

        const adminOrderRef = doc(collection(db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        await updateDoc(adminOrderRef, { warrantyPaymentStatus: 'paid' });
        console.log(`Warranty payment for order ${orderId} set to paid for admin.`);

        showNotification(`Đã xác nhận thanh toán gói bảo hành cho đơn hàng #${orderId}.`, 'success');
        closeModal(paymentWarrantyModal);
        renderOrders(currentOrderForWarranty.status);
    } catch (error) {
        console.error("Error admin confirming warranty payment:", error);
        showNotification(`Lỗi khi admin xác nhận thanh toán gói bảo hành: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
});


function displayOrderTrackingModal(order) {
    trackingShippingUnitImage.src = shopDataCache.shippingUnit.image || 'https://placehold.co/200x100/cccccc/333333?text=Shipping+Unit';
    trackingShippingUnitName.textContent = shopDataCache.shippingUnit.name || 'GHN Express';
    trackingOrderId.textContent = order.id;

    trackingProductDetails.innerHTML = '';
    order.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center space-x-2 text-sm mb-1';
        itemDiv.innerHTML = `
            <img src="${item.productImage}" onerror="this.onerror=null;this.src='https://placehold.co/40x40/cccccc/333333?text=SP';" class="w-10 h-10 object-cover rounded-md">
            <span>${item.productName} x ${item.quantity}</span>
        `;
        trackingProductDetails.appendChild(itemDiv);
    });

    trackingCurrentLocation.textContent = order.orderLocation || 'Đang cập nhật...';
    trackingDestination.textContent = order.customerAddress || 'N/A';

    checkRouteBtn.onclick = () => {
        const origin = encodeURIComponent(order.orderLocation || DEFAULT_WAREHOUSE_ADDRESS);
        const destination = encodeURIComponent(order.customerAddress);
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
        window.open(googleMapsUrl, '_blank');
    };

    openModal(orderTrackingModal);
}


// Authentication and User Management
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        console.log("User authenticated:", user.uid);
        const userProfileDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}`);
        try {
            const userDocSnap = await getDoc(userProfileDocRef);
            if (userDocSnap.exists()) {
                loggedInUser = { id: currentUserId, ...userDocSnap.data() };
                loggedInUser.isAdmin = (loggedInUser.email === shopDataCache.adminEmail);
                console.log("Logged in user data:", loggedInUser);
            } else {
                const isUserAdmin = (user.email === shopDataCache.adminEmail);
                loggedInUser = {
                    id: currentUserId,
                    username: user.email || `guest_${currentUserId.substring(0, 8)}}`,
                    fullname: '',
                    phone: '',
                    province: '',
                    isAdmin: isUserAdmin,
                    email: user.email
                };
                await setDoc(userProfileDocRef, loggedInUser);
                console.log("New user profile created:", loggedInUser);
            }

            // Set up real-time listeners for orders and cart based on user type
            if (!loggedInUser.isAdmin) {
                onSnapshot(collection(db, `artifacts/${appId}/users/${currentUserId}/orders`), (snapshot) => {
                    userOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log("User orders updated:", userOrdersCache);
                    if (loggedInUser) {
                        renderOrders('created');
                        renderOrders('shipping');
                        renderOrders('delivered');
                    }
                }, (error) => console.error("Error fetching user orders:", error));

                onSnapshot(doc(collection(db, `artifacts/${appId}/users/${currentUserId}/cart`), 'currentCart'), (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        userCartCache = docSnapshot.data().items || [];
                    } else {
                        userCartCache = [];
                    }
                    console.log("User cart updated:", userCartCache);
                    updateCartCount();
                    if (cartModal.classList.contains('active')) {
                        renderCart();
                    }
                }, (error) => console.error("Error fetching user cart:", error));
            } else {
                onSnapshot(collection(db, `artifacts/${appId}/public/data/adminOrders`), (snapshot) => {
                    userOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log("Admin orders updated:", userOrdersCache);
                    if (loggedInUser) {
                        renderOrders('created');
                        renderOrders('shipping');
                        renderOrders('delivered');
                    }
                }, (error) => console.error("Error fetching admin orders:", error));
            }
            setupChatListeners(); // Setup chat listeners after user is authenticated
        } catch (error) {
            console.error("Error during user profile fetching/creation:", error);
            showNotification(`Lỗi tải hồ sơ người dùng: ${error.message}`, 'error');
        }
    } else {
        loggedInUser = { id: null, username: 'Khách', isAdmin: false, email: null, fullname: '', phone: '', province: '' };
        currentUserId = null;
        userOrdersCache = [];
        userCartCache = [];
        console.log("User logged out.");
        // Unsubscribe from chat listeners if logged out
        if (chatUnsubscribe) {
            chatUnsubscribe();
            chatUnsubscribe = null;
        }
        if (chatListUnsubscribe) {
            chatListUnsubscribe();
            chatListUnsubscribe = null;
        }
    }
    updateAuthUI();
    updateChatFloatBtnUnreadCount(); // Update unread count on chat button
});

function updateAuthUI() {
    if (loggedInUser && loggedInUser.id) {
        loginStatusBtn.textContent = `Xin chào, ${loggedInUser.username || loggedInUser.email || 'Khách'}`;
        loginStatusBtn.onclick = logoutUser;
        openManagementModalBtn.style.display = loggedInUser.isAdmin ? 'block' : 'none';
        openSettingsModalBtn.style.display = loggedInUser.isAdmin ? 'block' : 'none';
        openShopAnalyticsModalBtn.style.display = loggedInUser.isAdmin ? 'block' : 'none';
        const adminVoucherSection = document.getElementById('add-admin-voucher-form').closest('.border-b.pb-6.border-gray-200');
        if (adminVoucherSection) {
            adminVoucherSection.style.display = loggedInUser.isAdmin ? 'block' : 'none';
        }

    } else {
        loginStatusBtn.textContent = 'Đăng nhập';
        loginStatusBtn.onclick = () => openModal(loginRegisterModal);
        openManagementModalBtn.style.display = 'none';
        openSettingsModalBtn.style.display = 'none';
        openShopAnalyticsModalBtn.style.display = 'none';
        const adminVoucherSection = document.getElementById('add-admin-voucher-form').closest('.border-b.pb-6.border-gray-200');
        if (adminVoucherSection) {
            adminVoucherSection.style.display = 'none';
        }
    }
}

loginStatusBtn.addEventListener('click', () => {
    if (!loggedInUser || !loggedInUser.id) {
        openModal(loginRegisterModal);
    } else {
        logoutUser();
    }
});

showRegisterFormLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    authModalTitle.textContent = 'Đăng ký';
    loginErrorMessage.classList.add('hidden');
    registerErrorMessage.classList.add('hidden');
});

showLoginFormLink.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authModalTitle.textContent = 'Đăng nhập';
    loginErrorMessage.classList.add('hidden');
    registerErrorMessage.classList.add('hidden');
});

registerSubmitBtn.addEventListener('click', async () => {
    const email = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value.trim();
    const confirmPassword = registerConfirmPasswordInput.value.trim();
    const fullname = registerFullnameInput.value.trim();
    const phone = registerPhoneInput.value.trim();
    const province = registerProvinceInput.value.trim();

    if (!email || !password || !confirmPassword || !fullname || !phone || !province) {
        registerErrorMessage.textContent = 'Vui lòng điền đầy đủ thông tin.';
        registerErrorMessage.classList.remove('hidden');
        return;
    }
    if (password !== confirmPassword) {
        registerErrorMessage.textContent = 'Mật khẩu và xác nhận mật khẩu không khớp.';
        registerErrorMessage.classList.remove('hidden');
        return;
    }

    showLoading();
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const isUserAdmin = (email === shopDataCache.adminEmail);

        await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}`), {
            username: email,
            fullname,
            phone,
            province,
            isAdmin: isUserAdmin,
            email: email
        });
        console.log("User registered and profile created:", user.uid);

        showNotification('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
        registerErrorMessage.classList.add('hidden');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authModalTitle.textContent = 'Đăng nhập';
        loginUsernameInput.value = email;
        loginPasswordInput.value = '';
    } catch (error) {
        console.error("Error during registration:", error);
        registerErrorMessage.textContent = `Lỗi đăng ký: ${error.message}`;
        registerErrorMessage.classList.remove('hidden');
    } finally {
        hideLoading();
    }
});

loginSubmitBtn.addEventListener('click', async () => {
    const email = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!email || !password) {
        loginErrorMessage.textContent = 'Vui lòng nhập email và mật khẩu.';
        loginErrorMessage.classList.remove('hidden');
        return;
    }

    showLoading();
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Đăng nhập thành công!', 'success');
        loginErrorMessage.classList.add('hidden');
        closeModal(loginRegisterModal);
    } catch (error) {
        console.error("Error during login:", error);
        loginErrorMessage.textContent = `Lỗi đăng nhập: ${error.message}`;
        loginErrorMessage.classList.remove('hidden');
    } finally {
        hideLoading();
    }
});

async function logoutUser() {
    showLoading();
    try {
        await signOut(auth);
        showNotification('Đã đăng xuất.', 'info');
    } catch (error) {
        console.error("Error during logout:", error);
        showNotification(`Lỗi đăng xuất: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function renderProfileModal() {
    if (loggedInUser) {
        profileUsernameInput.value = loggedInUser.username || '';
        profileFullnameInput.value = loggedInUser.fullname || '';
        profilePhoneInput.value = loggedInUser.phone || '';
        profileProvinceInput.value = loggedInUser.province || '';
    }
}

saveProfileBtn.addEventListener('click', async () => {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để lưu hồ sơ.', 'info');
        openModal(loginRegisterModal);
        return;
    }
    showLoading();
    try {
        const profileRef = doc(db, `artifacts/${appId}/users/${loggedInUser.id}`);
        await updateDoc(profileRef, {
            fullname: profileFullnameInput.value.trim(),
            phone: profilePhoneInput.value.trim(),
            province: profileProvinceInput.value.trim()
        });
        loggedInUser.fullname = profileFullnameInput.value.trim();
        loggedInUser.phone = profilePhoneInput.value.trim();
        loggedInUser.province = profileProvinceInput.value.trim();
        showNotification('Hồ sơ đã được cập nhật!', 'success');
        console.log("User profile updated.");
    } catch (error) {
        console.error("Error updating user profile:", error);
        profileErrorMessage.textContent = `Lỗi cập nhật hồ sơ: ${error.message}`;
        profileErrorMessage.classList.remove('hidden');
    } finally {
        hideLoading();
    }
});

async function saveUserCart() {
    if (loggedInUser && currentUserId) {
        showLoading();
        try {
            await setDoc(doc(collection(db, `artifacts/${appId}/users/${currentUserId}/cart`), 'currentCart'), { items: userCartCache });
            console.log("User cart saved.");
        } catch (error) {
            console.error("Error saving cart:", error);
            showNotification("Lỗi lưu giỏ hàng.", "error");
        } finally {
            hideLoading();
        }
    }
}

async function updateCartCount() {
    if (loggedInUser && currentUserId) {
        try {
            const cartDocSnap = await getDoc(doc(collection(db, `artifacts/${appId}/users/${currentUserId}/cart`), 'currentCart'));
            if (cartDocSnap.exists()) {
                userCartCache = cartDocSnap.data().items || [];
                const totalItems = userCartCache.reduce((sum, item) => sum + item.quantity, 0);
                cartCountSpan.textContent = totalItems;
            } else {
                userCartCache = [];
                cartCountSpan.textContent = 0;
            }
        } catch (error) {
            console.error("Error updating cart count:", error);
            cartCountSpan.textContent = 0;
        }
    } else {
        cartCountSpan.textContent = 0;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadShopData();
    showSection('product-list-section', showProductsBtn);
    updateAuthUI();
});

document.getElementById('open-address-in-map-btn').addEventListener('click', () => {
    const address = shopDataCache.address;
    if (address && address !== 'Chưa cập nhật') {
        const encodedAddress = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    } else {
        showNotification('Vui lòng cập nhật địa chỉ cửa hàng trong cài đặt trước.', 'info');
    }
});


// --- Chat Functionality ---

chatFloatBtn.addEventListener('click', openChatModal);
backToChatListBtn.addEventListener('click', () => {
    currentOpenChatId = null;
    if (chatUnsubscribe) {
        chatUnsubscribe(); // Unsubscribe from current chat messages
        chatUnsubscribe = null;
    }
    adminChatListContainer.classList.remove('hidden');
    chatMessagesArea.classList.add('hidden');
    chatModalTitle.textContent = 'Trò chuyện';
    backToChatListBtn.classList.add('hidden');
    renderChatList(); // Re-render the chat list for admin
});

sendChatBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function openChatModal() {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để trò chuyện.', 'info');
        openModal(loginRegisterModal);
        return;
    }

    openModal(chatModal);

    if (loggedInUser.isAdmin) {
        adminChatListContainer.classList.remove('hidden');
        chatMessagesArea.classList.add('hidden');
        backToChatListBtn.classList.add('hidden');
        chatModalTitle.textContent = 'Các cuộc trò chuyện';
        renderChatList();
    } else {
        adminChatListContainer.classList.add('hidden');
        chatMessagesArea.classList.remove('hidden');
        backToChatListBtn.classList.add('hidden'); // User doesn't need to go back to list
        chatModalTitle.textContent = `Trò chuyện với Admin`;
        await openConversation(loggedInUser.id); // Open user's own chat with admin
    }
    updateChatFloatBtnUnreadCount(); // Clear unread count on chat button when modal opens
}

async function renderChatList() {
    chatListContainer.innerHTML = '<p class="text-gray-500 italic text-center">Đang tải cuộc trò chuyện...</p>';
    if (chatListUnsubscribe) {
        chatListUnsubscribe(); // Unsubscribe from previous listener
    }

    const q = query(collection(db, CHAT_COLLECTION_PATH), orderBy('lastMessageTimestamp', 'desc'));
    chatListUnsubscribe = onSnapshot(q, (snapshot) => {
        chatListContainer.innerHTML = '';
        if (snapshot.empty) {
            chatListContainer.innerHTML = '<p class="text-gray-500 italic text-center">Chưa có cuộc trò chuyện nào.</p>';
            return;
        }

        snapshot.forEach(docSnap => {
            const chatData = docSnap.data();
            const chatId = docSnap.id;
            const isUnread = chatData.unreadCountAdmin > 0; // Admin sees unread if user sent new messages

            const chatListItem = document.createElement('div');
            chatListItem.className = `chat-list-item ${isUnread ? 'unread' : ''}`;
            chatListItem.innerHTML = `
                <div class="flex justify-between items-center">
                    <p class="font-semibold text-gray-800">${chatData.userName || `Người dùng ${chatId.substring(0, 8)}`}</p>
                    ${isUnread ? `<span class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">${chatData.unreadCountAdmin}</span>` : ''}
                </div>
                <p class="text-sm text-gray-600 truncate">${chatData.lastMessageText || 'Chưa có tin nhắn nào.'}</p>
                <p class="text-xs text-gray-500 text-right">${chatData.lastMessageTimestamp ? new Date(chatData.lastMessageTimestamp).toLocaleString('vi-VN') : ''}</p>
            `;
            chatListItem.addEventListener('click', async () => {
                await openConversation(chatId);
            });
            chatListContainer.appendChild(chatListItem);
        });
    }, (error) => {
        console.error("Error fetching chat list:", error);
        chatListContainer.innerHTML = '<p class="text-red-500 italic text-center">Lỗi tải danh sách trò chuyện.</p>';
    });
}

async function openConversation(chatId) {
    currentOpenChatId = chatId;
    adminChatListContainer.classList.add('hidden');
    chatMessagesArea.classList.remove('hidden');
    if (loggedInUser.isAdmin) {
        backToChatListBtn.classList.remove('hidden');
    }
    chatModalTitle.textContent = `Trò chuyện với ${loggedInUser.isAdmin ? (chatId === loggedInUser.id ? 'chính bạn' : (await getUserName(chatId))) : 'Admin'}`;

    chatMessagesDiv.innerHTML = '<p class="text-gray-500 italic text-center">Đang tải tin nhắn...</p>';
    chatInput.value = ''; // Clear input field

    if (chatUnsubscribe) {
        chatUnsubscribe(); // Unsubscribe from previous chat
    }

    const messagesRef = collection(db, CHAT_COLLECTION_PATH, chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp'));

    chatUnsubscribe = onSnapshot(q, async (snapshot) => {
        chatMessagesDiv.innerHTML = '';
        if (snapshot.empty) {
            chatMessagesDiv.innerHTML = '<p class="text-gray-500 italic text-center">Chưa có tin nhắn nào.</p>';
        } else {
            snapshot.forEach(msgDoc => {
                const msg = msgDoc.data();
                const messageDiv = document.createElement('div');
                messageDiv.className = `chat-message ${msg.senderId === loggedInUser.id ? 'user' : 'admin'}`;
                messageDiv.innerHTML = `
                    <p class="sender-name">${msg.senderName}</p>
                    <p>${msg.text}</p>
                    <p class="timestamp">${new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                `;
                chatMessagesDiv.appendChild(messageDiv);
            });
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
        }

        // Mark messages as read after rendering
        await markMessagesAsRead(chatId, loggedInUser.id, loggedInUser.isAdmin);
        updateChatFloatBtnUnreadCount(); // Update unread count on chat button
    }, (error) => {
        console.error("Error fetching messages:", error);
        chatMessagesDiv.innerHTML = '<p class="text-red-500 italic text-center">Lỗi tải tin nhắn.</p>';
    });
}

async function sendMessage() {
    if (!loggedInUser || !loggedInUser.id) {
        showNotification('Vui lòng đăng nhập để gửi tin nhắn.', 'info');
        return;
    }
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    showLoading();
    try {
        const chatDocRef = doc(db, CHAT_COLLECTION_PATH, currentOpenChatId || loggedInUser.id);
        const chatDocSnap = await getDoc(chatDocRef);

        let senderName = loggedInUser.fullname || loggedInUser.username || loggedInUser.email || 'Người dùng';
        if (loggedInUser.isAdmin) {
            senderName = 'Admin';
        }

        const messageData = {
            senderId: loggedInUser.id,
            senderName: senderName,
            text: messageText,
            timestamp: new Date().toISOString(),
            // Messages are considered unread by the recipient until they open the chat
            isRead: false // This will be updated by the recipient's client
        };

        if (!chatDocSnap.exists()) {
            // Create new chat document if it doesn't exist
            await setDoc(chatDocRef, {
                userId: loggedInUser.id,
                userName: loggedInUser.fullname || loggedInUser.username || loggedInUser.email,
                lastMessageText: messageText,
                lastMessageTimestamp: messageData.timestamp,
                unreadCountUser: loggedInUser.isAdmin ? 1 : 0, // If admin sends, user has 1 unread
                unreadCountAdmin: loggedInUser.isAdmin ? 0 : 1  // If user sends, admin has 1 unread
            });
        } else {
            // Update existing chat document
            const currentChatData = chatDocSnap.data();
            const updates = {
                lastMessageText: messageText,
                lastMessageTimestamp: messageData.timestamp,
            };
            if (loggedInUser.isAdmin) {
                updates.unreadCountUser = (currentChatData.unreadCountUser || 0) + 1;
            } else {
                updates.unreadCountAdmin = (currentChatData.unreadCountAdmin || 0) + 1;
            }
            await updateDoc(chatDocRef, updates);
        }

        // Add message to subcollection
        await addDoc(collection(chatDocRef, 'messages'), messageData);

        chatInput.value = '';
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
        showNotification('Tin nhắn đã được gửi!', 'success');
    } catch (error) {
        console.error("Error sending message:", error);
        showNotification(`Lỗi gửi tin nhắn: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function markMessagesAsRead(chatId, readerUserId, isReaderAdmin) {
    try {
        const chatDocRef = doc(db, CHAT_COLLECTION_PATH, chatId);
        const messagesRef = collection(chatDocRef, 'messages');
        const q = query(messagesRef, where('isRead', '==', false)); // Only mark unread messages

        const snapshot = await getDocs(q);
        const batch = db.batch();
        let messagesMarked = 0;

        snapshot.forEach(msgDoc => {
            const msg = msgDoc.data();
            // Mark as read only if the message was sent by the other party
            if ((isReaderAdmin && msg.senderId !== readerUserId) || (!isReaderAdmin && msg.senderId === shopDataCache.adminEmail)) {
                batch.update(msgDoc.ref, { isRead: true });
                messagesMarked++;
            }
        });

        // Update unread counts in the main chat document
        if (messagesMarked > 0) {
            const chatUpdates = {};
            if (isReaderAdmin) {
                chatUpdates.unreadCountAdmin = 0; // Admin has read all messages
            } else {
                chatUpdates.unreadCountUser = 0; // User has read all messages
            }
            batch.update(chatDocRef, chatUpdates);
        }

        await batch.commit();
        console.log(`Marked ${messagesMarked} messages as read for chat ${chatId} by ${readerUserId}.`);
    } catch (error) {
        console.error("Error marking messages as read:", error);
    }
}

async function updateChatFloatBtnUnreadCount() {
    if (!loggedInUser || !loggedInUser.id) {
        chatUnreadCountSpan.classList.add('hidden');
        chatUnreadCountSpan.textContent = '0';
        return;
    }

    let totalUnread = 0;
    if (loggedInUser.isAdmin) {
        // Admin sums unreadCountAdmin from all chats
        try {
            const q = collection(db, CHAT_COLLECTION_PATH);
            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                totalUnread += (docSnap.data().unreadCountAdmin || 0);
            });
        } catch (error) {
            console.error("Error fetching admin unread count:", error);
        }
    } else {
        // User checks their own unreadCountUser
        try {
            const chatDocRef = doc(db, CHAT_COLLECTION_PATH, loggedInUser.id);
            const chatDocSnap = await getDoc(chatDocRef);
            if (chatDocSnap.exists()) {
                totalUnread = chatDocSnap.data().unreadCountUser || 0;
            }
        } catch (error) {
            console.error("Error fetching user unread count:", error);
        }
    }

    if (totalUnread > 0) {
        chatUnreadCountSpan.textContent = totalUnread;
        chatUnreadCountSpan.classList.remove('hidden');
    } else {
        chatUnreadCountSpan.classList.add('hidden');
    }
}

async function setupChatListeners() {
    if (loggedInUser && loggedInUser.id) {
        if (loggedInUser.isAdmin) {
            // Admin listens to all chats for unread counts
            if (chatListUnsubscribe) chatListUnsubscribe(); // Unsubscribe previous if exists
            chatListUnsubscribe = onSnapshot(collection(db, CHAT_COLLECTION_PATH), (snapshot) => {
                updateChatFloatBtnUnreadCount();
                if (adminChatListContainer.classList.contains('active')) { // If admin chat list is open
                    renderChatList(); // Re-render the list to show updated unread counts
                }
            }, (error) => console.error("Error listening to admin chat list for unread:", error));
        } else {
            // Regular user listens to their own chat for unread counts
            const chatDocRef = doc(db, CHAT_COLLECTION_PATH, loggedInUser.id);
            if (chatUnsubscribe) chatUnsubscribe(); // Unsubscribe previous if exists
            chatUnsubscribe = onSnapshot(chatDocRef, (docSnap) => {
                updateChatFloatBtnUnreadCount();
                if (chatModal.classList.contains('active') && !loggedInUser.isAdmin) {
                    // If user's chat modal is open, re-render messages
                    openConversation(loggedInUser.id);
                }
            }, (error) => console.error("Error listening to user chat for unread:", error));
        }
    } else {
        // No user logged in, ensure listeners are unsubscribed
        if (chatUnsubscribe) {
            chatUnsubscribe();
            chatUnsubscribe = null;
        }
        if (chatListUnsubscribe) {
            chatListUnsubscribe();
            chatListUnsubscribe = null;
        }
    }
    updateChatFloatBtnUnreadCount();
}

// Helper to get user name for admin chat list
async function getUserName(userId) {
    try {
        const userDoc = await getDoc(doc(db, `artifacts/${appId}/users/${userId}`));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            return userData.fullname || userData.username || userData.email || `Người dùng ${userId.substring(0, 8)}`;
        }
        return `Người dùng ${userId.substring(0, 8)}`;
    } catch (error) {
        console.error("Error fetching user name:", error);
        return `Người dùng ${userId.substring(0, 8)}`;
    }
}
