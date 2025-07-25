import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment
// __app_id: The unique ID for the current application instance.
// __firebase_config: Firebase configuration object (JSON string) for initializing the app.
// __initial_auth_token: Custom Firebase authentication token for initial sign-in.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    // User's provided Firebase configuration for local testing
    apiKey: "AIzaSyAJmYFnLAhskjszeK5DZve4z0wRXrXl7Sc",
    authDomain: "iphonechinhhang-47bdd.firebaseapp.com",
    projectId: "iphonechinhhang-47bdd",
    storageBucket: "iphonechinhhang-47bdd.firebasestorage.app",
    messagingSenderId: "308005027963",
    appId: "1:308005027963:web:35afe47c3ace690e38e2de",
    measurementId: "G-PQ7450T99T"
};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Firebase App and Services (Globally accessible via window)
window.app = initializeApp(firebaseConfig);
window.db = getFirestore(window.app);
window.auth = getAuth(window.app);

// Global State Variables (Globally accessible via window)
window.loggedInUser = null;
window.currentUserId = null;
window.shopDataCache = {
    products: [],
    vouchers: {}, // Voucher structure will be updated to include expiry
    warrantyPackages: [],
    bankDetails: {},
    advertisement: {},
    shippingUnit: {},
    name: 'Thegioididong.com',
    address: 'Chưa cập nhật',
    backgroundImg: '',
    adminEmail: 'dimensiongsv@gmail.com', // Default admin email
    rewards: [] // Lucky wheel rewards, now managed centrally
};
window.userOrdersCache = [];
window.userCartCache = [];

const DEFAULT_WAREHOUSE_ADDRESS = "194 Đ. Lê Duẩn, Khâm Thiên, Đống Đa, Hà Nội";

// Utility UI Elements & Functions (Globally accessible via window)
const loadingOverlay = document.createElement('div');
loadingOverlay.id = 'loadingIndicator';
loadingOverlay.className = 'loading-overlay hidden';
loadingOverlay.innerHTML = '<div class="loading-spinner"></div>';
document.body.appendChild(loadingOverlay);

const messageDisplay = document.createElement('div');
messageDisplay.id = 'messageDisplay';
messageDisplay.className = 'message hidden fixed p-4 rounded-lg shadow-lg z-50 top-1/4 left-1/2 transform -translate-x-1/2 opacity-0 transition-all duration-500 ease-in-out';
document.body.appendChild(messageDisplay);

const confirmModal = document.createElement('div');
confirmModal.id = 'confirm-modal';
confirmModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center hidden z-50';
confirmModal.innerHTML = `
    <div class="bg-white p-6 rounded-lg shadow-xl w-80">
        <p id="confirm-message" class="mb-4 text-lg font-semibold text-gray-800"></p>
        <div class="flex justify-end space-x-3">
            <button id="confirm-cancel-btn" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-full transition-colors duration-200">Hủy</button>
            <button id="confirm-ok-btn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full transition-colors duration-200">Xác nhận</button>
        </div>
    </div>
`;
document.body.appendChild(confirmModal);

const confirmMessageElement = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
let confirmCallback = null;

window.showLoading = function() { loadingOverlay.classList.remove('hidden'); };
window.hideLoading = function() { loadingOverlay.classList.add('hidden'); };

window.showMessage = function(message, type = 'info') {
    messageDisplay.textContent = message;
    messageDisplay.className = `message fixed p-4 rounded-lg shadow-lg z-50
                                top-1/4 left-1/2 transform -translate-x-1/2
                                opacity-0 transition-all duration-500 ease-in-out`;

    if (type === 'success') {
        messageDisplay.classList.add('bg-green-500', 'text-white');
    } else if (type === 'error') {
        messageDisplay.classList.add('bg-red-500', 'text-white');
    } else {
        messageDisplay.classList.add('bg-blue-500', 'text-white');
    }

    messageDisplay.classList.remove('hidden');
    setTimeout(() => {
        messageDisplay.classList.add('opacity-100');
    }, 10);

    setTimeout(() => {
        messageDisplay.classList.remove('opacity-100');
        setTimeout(() => {
            messageDisplay.classList.add('hidden');
            messageDisplay.textContent = '';
        }, 500);
    }, 3000);
};

window.showConfirmModal = function(message, onConfirm) {
    confirmMessageElement.textContent = message;
    confirmModal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    confirmCallback = onConfirm;
};

window.closeConfirmModal = function() {
    confirmModal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    confirmCallback = null;
};

confirmOkBtn.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback(true);
    }
    window.closeConfirmModal();
});

confirmCancelBtn.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback(false);
    }
    window.closeConfirmModal();
});

window.openModal = function(modalElement) {
    modalElement.classList.remove('hidden');
    modalElement.classList.add('active');
    document.body.classList.add('overflow-hidden');
};

window.closeModal = function(modalElement) {
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
};

window.formatCurrency = function(amount) {
    if (typeof amount !== 'number') return amount;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

window.generateId = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

window.saveShopData = async function() {
    window.showLoading();
    try {
        await setDoc(doc(collection(window.db, `artifacts/${appId}/public/data/shopSettings`), 'shopData'), window.shopDataCache);
        window.showMessage('Dữ liệu cửa hàng đã được lưu!', 'success');
        console.log("Shop data successfully saved to Firestore.");
    } catch (error) {
        console.error("Error saving shop data:", error);
        window.showMessage(`Lỗi lưu dữ liệu cửa hàng: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
};

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
const voucherExpiryMessage = document.getElementById('voucher-expiry-message'); // New element

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
const newVoucherValueInput = document.getElementById('new-voucher-value');
const newVoucherExpiryInput = document.getElementById('new-voucher-expiry'); // New: Voucher expiry input
const currentVouchersList = document.getElementById('current-vouchers-list');

// New Admin Voucher elements
const addAdminVoucherForm = document.getElementById('add-admin-voucher-form');
const newAdminVoucherCodeInput = document.getElementById('new-admin-voucher-code');
const newAdminVoucherTypeSelect = document.getElementById('new-admin-voucher-type'); // New element
const newAdminVoucherValueInput = document.getElementById('new-admin-voucher-value');
const newAdminVoucherExpiryInput = document.getElementById('new-admin-voucher-expiry');
const adminVoucherValueContainer = document.getElementById('admin-voucher-value-container'); // New element


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
const clearSearchDeliveredOrdersBtn = document.getElementById('clear-search-delivered-experiments');


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


function showSection(sectionId, clickedButton) {
    allSections.forEach(section => section.classList.add('hidden'));
    document.getElementById(sectionId).classList.remove('hidden');
    allTabButtons.forEach(btn => btn.classList.remove('active'));
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

async function loadShopData() {
    window.showLoading();
    try {
        const shopDocRef = doc(collection(window.db, `artifacts/${appId}/public/data/shopSettings`), 'shopData');

        onSnapshot(shopDocRef, async (shopDocSnap) => {
            if (shopDocSnap.exists()) {
                // Merge data from Firestore, ensuring existing properties are not lost
                Object.assign(window.shopDataCache, shopDocSnap.data());
                console.log("Shop data loaded from Firestore (real-time):", window.shopDataCache);
            } else {
                console.log("No shop data found in Firestore. Initializing with default data.");
                await setDoc(shopDocRef, window.shopDataCache);
                window.showMessage('Đã tạo dữ liệu cửa hàng mặc định.', 'info');
            }

            // Check if products array is empty and add a default product if it is
            if (!window.shopDataCache.products || window.shopDataCache.products.length === 0) {
                const defaultProduct = {
                    id: window.generateId(),
                    name: 'iPhone 16 Pro Max',
                    basePrice: 30000000,
                    image: 'https://placehold.co/400x300/cccccc/333333?text=iPhone+16+Pro+Max',
                    description: 'iPhone 16 Pro Max là siêu phẩm mới nhất của Apple, với chip A18 Bionic mạnh mẽ, camera cải tiến vượt trội và màn hình ProMotion siêu mượt.',
                    reviewsCount: 500,
                    colors: [
                        { name: 'Titan Tự Nhiên', priceImpact: 0, display_image: 'https://placehold.co/400x300/8B8B8B/ffffff?text=Titan+Tự+Nhiên' },
                        { name: 'Titan Xanh', priceImpact: 500000, display_image: 'https://placehold.co/400x300/00008B/ffffff?text=Titan+Xanh' },
                        { name: 'Titan Trắng', priceImpact: 500000, display_image: 'https://placehold.co/400x300/F0F8FF/333333?text=Titan+Trắng' },
                        { name: 'Titan Đen', priceImpact: 0, display_image: 'https://placehold.co/400x300/2C3539/ffffff?text=Titan+Đen' }
                    ],
                    storages: [
                        { name: '256GB', priceImpact: 0 },
                        { name: '512GB', priceImpact: 3000000 },
                        { name: '1TB', priceImpact: 7000000 }
                    ],
                    variants: [
                        { color: 'Titan Tự Nhiên', storage: '256GB', quantity: 100, priceImpact: 0, sold: 20 },
                        { color: 'Titan Tự Nhiên', storage: '512GB', quantity: 70, priceImpact: 0, sold: 15 },
                        { color: 'Titan Tự Nhiên', storage: '1TB', quantity: 30, priceImpact: 0, sold: 5 },
                        { color: 'Titan Xanh', storage: '256GB', quantity: 80, priceImpact: 0, sold: 10 },
                        { color: 'Titan Xanh', storage: '512GB', quantity: 50, priceImpact: 0, sold: 8 },
                        { color: 'Titan Xanh', storage: '1TB', quantity: 20, priceImpact: 0, sold: 3 },
                        { color: 'Titan Trắng', storage: '256GB', quantity: 90, priceImpact: 0, sold: 18 },
                        { color: 'Titan Trắng', storage: '512GB', quantity: 60, priceImpact: 0, sold: 12 },
                        { color: 'Titan Trắng', storage: '1TB', quantity: 25, priceImpact: 0, sold: 4 },
                        { color: 'Titan Đen', storage: '256GB', quantity: 95, priceImpact: 0, sold: 22 },
                        { color: 'Titan Đen', storage: '512GB', quantity: 65, priceImpact: 0, sold: 10 },
                        { color: 'Titan Đen', storage: '1TB', quantity: 28, priceImpact: 0, sold: 6 }
                    ]
                };
                window.shopDataCache.products = [defaultProduct];
                await setDoc(shopDocRef, window.shopDataCache);
                window.showMessage('Đã tạo sản phẩm mặc định iPhone 16 Pro Max.', 'info');
                console.log("Default iPhone 16 Pro Max product added and saved.");
            }

            loadShopSettingsToUI();
            renderProducts();
            renderProductManagementList();
            renderVouchersList();
            renderWarrantyPackagesList();
            // Note: `drawWheel()` and `renderRewardsList()` from script2.js will be called
            // by its own `DOMContentLoaded` or its `onSnapshot` listener to shopData.
            window.hideLoading();
        }, (error) => {
            console.error("Error loading shop data with onSnapshot:", error);
            window.showMessage(`Lỗi tải dữ liệu cửa hàng: ${error.message}`, 'error');
            window.hideLoading();
        });

    } catch (error) {
        console.error("Error setting up shop data listener:", error);
        window.showMessage(`Lỗi thiết lập lắng nghe dữ liệu cửa hàng: ${error.message}`, 'error');
        window.hideLoading();
    }
}

async function loadShopSettingsToUI() {
    shopNameDisplay.innerHTML = `<i class="fas fa-mobile-alt mr-2 text-gray-700"></i><span class="text-gray-900">${window.shopDataCache.name.replace('.com', '')}</span><span class="text-red-600">.com</span>`;
    pageTitle.textContent = window.shopDataCache.name;
    shopAddressDisplay.textContent = window.shopDataCache.address;

    if (window.shopDataCache.backgroundImg) {
        bodyElement.style.backgroundImage = `url('${window.shopDataCache.backgroundImg}')`;
    } else {
        bodyElement.style.backgroundImage = 'none';
        bodyElement.style.backgroundColor = '#fdf8f4';
    }

    shopNameInput.value = window.shopDataCache.name || '';
    shopAddressInput.value = window.shopDataCache.address || '';
    backgroundImageURLInput.value = window.shopDataCache.backgroundImg || '';
    advertisementTextInput.value = window.shopDataCache.advertisement.text || '';
    advertisementAnimationSelect.value = window.shopDataCache.advertisement.animation || 'none';
    bankNameInput.value = window.shopDataCache.bankDetails.bankName || '';
    accountNumberInput.value = window.shopDataCache.bankDetails.accountNumber || '';
    accountHolderInput.value = window.shopDataCache.bankDetails.accountHolder || '';
    qrCodeImageURLInput.value = window.shopDataCache.bankDetails.qrCodeImage || '';
    shippingUnitNameInput.value = window.shopDataCache.shippingUnit.name || 'GHN Express';
    shippingUnitImageURLInput.value = window.shopDataCache.shippingUnit.image || '';
    if (adminEmailInput) {
        adminEmailInput.value = window.shopDataCache.adminEmail || '';
    }

    updateAdvertisementBanner();
}

function updateAdvertisementBanner() {
    const adText = window.shopDataCache.advertisement.text;
    const adAnimation = window.shopDataCache.advertisement.animation;
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
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Chờ admin kiểm duyệt', 'info');
        return;
    }
    window.showLoading();
    window.shopDataCache.name = shopNameInput.value.trim();
    window.shopDataCache.address = shopAddressInput.value.trim();
    window.shopDataCache.backgroundImg = backgroundImageURLInput.value.trim();
    window.shopDataCache.advertisement.text = advertisementTextInput.value.trim();
    window.shopDataCache.advertisement.animation = advertisementAnimationSelect.value;
    window.shopDataCache.bankDetails.bankName = bankNameInput.value.trim();
    window.shopDataCache.bankDetails.accountNumber = accountNumberInput.value.trim();
    window.shopDataCache.bankDetails.accountHolder = accountHolderInput.value.trim();
    window.shopDataCache.bankDetails.qrCodeImage = qrCodeImageURLInput ? qrCodeImageURLInput.value.trim() : '';
    window.shopDataCache.shippingUnit.name = shippingUnitNameInput ? shippingUnitNameInput.value.trim() : '';
    window.shopDataCache.shippingUnit.image = shippingUnitImageURLInput ? shippingUnitImageURLInput.value.trim() : '';
    window.shopDataCache.adminEmail = adminEmailInput ? adminEmailInput.value.trim() : '';
    await window.saveShopData();
    loadShopSettingsToUI();
    window.hideLoading();
    window.closeModal(shopSettingsModal);
});

document.getElementById('upload-main-image-btn').addEventListener('click', () => {
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Chờ admin kiểm duyệt', 'info');
        return;
    }
    const imageUrl = prompt('Nhập URL hình ảnh sản phẩm (URL trực tiếp, GitHub Raw, hoặc chuỗi Base64):');
    if (imageUrl) {
        newProductImageInput.value = imageUrl;
    }
});
document.getElementById('upload-background-btn').addEventListener('click', () => {
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Chờ admin kiểm duyệt', 'info');
        return;
    }
    const imageUrl = prompt('Nhập URL hình ảnh nền (URL trực tiếp, GitHub Raw, hoặc chuỗi Base64):');
    if (imageUrl) {
        backgroundImageURLInput.value = imageUrl;
    }
});
uploadQrCodeBtn.addEventListener('click', () => {
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Chờ admin kiểm duyệt', 'info');
        return;
    }
    const imageUrl = prompt('Nhập URL hình ảnh QR Code ngân hàng (URL trực tiếp, GitHub Raw, hoặc chuỗi Base64):');
    if (imageUrl) {
        qrCodeImageURLInput.value = imageUrl;
    }
});
uploadShippingUnitImageBtn.addEventListener('click', () => {
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Chờ admin kiểm duyệt', 'info');
        return;
    }
    const imageUrl = prompt('Nhập URL hình ảnh đơn vị vận chuyển (URL trực tiếp, GitHub Raw, hoặc chuỗi Base64):');
    if (imageUrl) {
        shippingUnitImageURLInput.value = imageUrl;
    }
});

closeProductModalBtn.addEventListener('click', () => {
    window.closeModal(productDetailModal);
    if (voucherCountdownInterval) {
        clearInterval(voucherCountdownInterval);
        voucherCountdownInterval = null;
    }
});
closeOrderModalBtn.addEventListener('click', () => window.closeModal(orderCreationModal));
closeEditShippingModalBtn.addEventListener('click', () => window.closeModal(editShippingOrderModal));
closeManagementModalBtn.addEventListener('click', () => window.closeModal(shopManagementModal));
closeSettingsModalBtn.addEventListener('click', () => window.closeModal(shopSettingsModal));
closeAnalyticsModalBtn.addEventListener('click', () => window.closeModal(shopAnalyticsModal));
closeCartModalBtn.addEventListener('click', () => window.closeModal(cartModal));
closePaymentVATModalBtn.addEventListener('click', () => window.closeModal(paymentVATModal));
closeOrderTrackingModalBtn.addEventListener('click', () => window.closeModal(orderTrackingModal));
closePaymentWarrantyModalBtn.addEventListener('click', () => window.closeModal(paymentWarrantyModal));
closeLoginRegisterModalBtn.addEventListener('click', () => window.closeModal(loginRegisterModal));
closeProfileModalBtn.addEventListener('click', () => window.closeModal(profileModal));

productDetailModal.addEventListener('click', (e) => {
    if (e.target === productDetailModal) {
        window.closeModal(productDetailModal);
        if (voucherCountdownInterval) {
            clearInterval(voucherCountdownInterval);
            voucherCountdownInterval = null;
        }
    }
});
orderCreationModal.addEventListener('click', (e) => { if (e.target === orderCreationModal) window.closeModal(orderCreationModal); });
editShippingOrderModal.addEventListener('click', (e) => { if (e.target === editShippingOrderModal) window.closeModal(editShippingOrderModal); });
shopManagementModal.addEventListener('click', (e) => { if (e.target === shopManagementModal) window.closeModal(shopManagementModal); });
shopSettingsModal.addEventListener('click', (e) => { if (e.target === shopSettingsModal) window.closeModal(shopSettingsModal); });
shopAnalyticsModal.addEventListener('click', (e) => { if (e.target === shopAnalyticsModal) window.closeModal(shopAnalyticsModal); });
cartModal.addEventListener('click', (e) => { if (e.target === cartModal) window.closeModal(cartModal); });
paymentVATModal.addEventListener('click', (e) => { if (e.target === paymentVATModal) window.closeModal(paymentVATModal); });
orderTrackingModal.addEventListener('click', (e) => { if (e.target === orderTrackingModal) window.closeModal(orderTrackingModal); });
paymentWarrantyModal.addEventListener('click', (e) => { if (e.target === paymentWarrantyModal) window.closeModal(paymentWarrantyModal); });
loginRegisterModal.addEventListener('click', (e) => { if (e.target === loginRegisterModal) window.closeModal(loginRegisterModal); });
profileModal.addEventListener('click', (e) => { if (e.target === profileModal) window.closeModal(profileModal); });

// Adjusted openManagementModalBtn listener to use existing window.openModal
// and delegate specific rendering to script2.js for rewards.
openManagementModalBtn.addEventListener('click', () => {
    if (!window.loggedInUser) {
        window.showMessage('Vui lòng đăng nhập để sử dụng chức năng này.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    if (!window.loggedInUser.isAdmin) {
        window.showMessage('Bạn không có quyền truy cập chức năng này.', 'info');
        return;
    }
    window.openModal(shopManagementModal);
    renderProductManagementList();
    renderWarrantyPackagesList();
    resetAddEditProductForm();
    resetAddEditWarrantyPackageForm();
    // No direct call to script2.js functions here, script2.js will listen to modal open event or onSnapshot.
});


openSettingsModalBtn.addEventListener('click', () => {
    if (!window.loggedInUser) {
        window.showMessage('Vui lòng đăng nhập để sử dụng chức năng này.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    if (!window.loggedInUser.isAdmin) {
        window.showMessage('Bạn không có quyền truy cập chức năng này.', 'info');
        return;
    }
    window.openModal(shopSettingsModal);
});
openShopAnalyticsModalBtn.addEventListener('click', () => {
    if (!window.loggedInUser) {
        window.showMessage('Vui lòng đăng nhập để sử dụng chức năng này.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    if (!window.loggedInUser.isAdmin) {
        window.showMessage('Bạn không có quyền truy cập chức năng này.', 'info');
        return;
    }
    window.openModal(shopAnalyticsModal);
    generateShopReport();
});
openCartModalBtn.addEventListener('click', () => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    window.openModal(cartModal);
    renderCart();
});

showProductsBtn.addEventListener('click', (e) => showSection('product-list-section', e.target));
showCreatedOrdersBtn.addEventListener('click', (e) => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để xem đơn hàng.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    showSection('created-orders-section', e.target);
    renderOrders('created');
});
showShippingOrdersBtn.addEventListener('click', (e) => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để xem đơn hàng.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    showSection('shipping-orders-section', e.target);
    renderOrders('shipping');
});
showDeliveredOrdersBtn.addEventListener('click', (e) => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để xem đơn hàng.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    showSection('delivered-orders-section', e.target);
    renderOrders('delivered');
});
openProfileModalBtn.addEventListener('click', () => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để xem hồ sơ.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    renderProfileModal();
    window.openModal(profileModal);
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

function renderProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card bg-white rounded-xl shadow-lg p-6 flex flex-col items-center text-center hover:shadow-xl transition-shadow duration-300 relative';
    const starsHtml = '<div class="star-rating text-yellow-400 mb-2">' + '<i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>' + ` <span class="text-gray-600 text-sm">(${product.reviewsCount || 0} đánh giá)</span>` + '</div>';
    card.innerHTML = `
        <img src="${product.image}" onerror="this.onerror=null;this.src='https://placehold.co/300x200/cccccc/333333?text=No+Image';" alt="${product.name}" class="w-full h-48 object-cover rounded-lg mb-4 shadow-md">
        <h3 class="text-xl font-semibold mb-2 text-gray-900">${product.name}</h3>
        <p class="text-lg text-gray-700">Giá sản phẩm: <span class="font-bold">${window.formatCurrency(product.basePrice)}</span></p>
        ${starsHtml}
        <button data-product-id="${product.id}" class="view-product-btn mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-full transition-all duration-200 shadow-md">Xem chi tiết</button>
    `;
    return card;
}

function renderProducts(searchTerm = '') {
    const productGrid = document.getElementById('product-grid');
    productGrid.innerHTML = '';
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filteredProducts = window.shopDataCache.products.filter(product =>
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
            const product = window.shopDataCache.products.find(p => p.id === productId);
            if (product) {
                if (!window.loggedInUser || !window.loggedInUser.id) {
                    window.showMessage('Vui lòng đăng nhập để xem chi tiết sản phẩm.', 'info');
                    window.openModal(loginRegisterModal);
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
    modalProductBasePrice.textContent = window.formatCurrency(product.basePrice);
    modalProductDescription.textContent = product.description;
    productOptionsContainer.innerHTML = '';
    voucherExpiryMessage.classList.add('hidden');

    modalProductPriceDisplay.classList.remove('line-through', 'text-gray-500');

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
        productOptionsContainer.appendChild(storageButtonsDiv);
        selectOption('storage', product.storages[0].name, product.storages[0].priceImpact, storageButtonsDiv.children[0]);
    } else {
        currentSelectedOptions.storage = null;
    }
    calculateProductPrice();
    window.openModal(productDetailModal);
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
        window.showMessage('Mã voucher đã hết hạn.', 'error');
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

    let isVoucherAppliedAndValid = false;
    if (currentAppliedVoucher) {
        const now = new Date();
        const expiryTime = new Date(currentAppliedVoucher.expiry);
        if (expiryTime > now) {
            isVoucherAppliedAndValid = true;
            if (currentAppliedVoucher.type === 'percentage') {
                discountedPrice = finalPrice * (1 - currentAppliedVoucher.value);
            } else if (currentAppliedVoucher.type === 'fixed') {
                discountedPrice = finalPrice - currentAppliedVoucher.value;
            }
            if (voucherCountdownInterval) {
                clearInterval(voucherCountdownInterval);
            }
            voucherCountdownInterval = setInterval(updateVoucherCountdown, 1000);
            updateVoucherCountdown();
        } else {
            currentAppliedVoucher = null;
            window.showMessage('Mã voucher đã hết hạn.', 'error');
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

    currentCalculatedPrice = isVoucherAppliedAndValid ? discountedPrice : finalPrice;

    modalProductPriceDisplay.textContent = window.formatCurrency(finalPrice);
    if (isVoucherAppliedAndValid) {
        modalProductPriceDisplay.classList.add('line-through', 'text-gray-500');
    } else {
        modalProductPriceDisplay.classList.remove('line-through', 'text-gray-500');
    }

    modalProductVATDisplay.textContent = window.formatCurrency(customerVatPortion);
    modalProductSold.textContent = soldQuantity;
    modalProductRemaining.textContent = remainingQuantity;

    if (isVoucherAppliedAndValid) {
        modalProductDiscountDisplay.classList.remove('hidden');
        modalProductDiscountDisplay.textContent = `Giá sau voucher: ${window.formatCurrency(discountedPrice)}`;
    } else {
        modalProductDiscountDisplay.classList.add('hidden');
    }
}

applyVoucherBtn.addEventListener('click', () => {
    const voucherCode = voucherCodeInput.value.trim().toUpperCase();
    const voucher = window.shopDataCache.vouchers[voucherCode];

    if (voucher) {
        if (voucher.isAdminVoucher && (!window.loggedInUser || !window.loggedInUser.isAdmin)) {
            currentAppliedVoucher = null;
            window.showMessage('Mã voucher này chỉ dành cho quản trị viên.', 'error');
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
                displayValue: voucher.displayValue
            };
            window.showMessage(`Áp dụng voucher thành công!`, 'success');
        } else {
            currentAppliedVoucher = null;
            window.showMessage('Mã voucher đã hết hạn.', 'error');
        }
    } else {
        currentAppliedVoucher = null;
        window.showMessage('Mã voucher không hợp lệ hoặc không tồn tại.', 'error');
    }
    calculateProductPrice();
});

buyNowDetailBtn.addEventListener('click', () => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để mua hàng.', 'info');
        window.openModal(loginRegisterModal);
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
    window.openModal(orderCreationModal);
    populateOrderCreationModal();
});

addToCartDetailBtn.addEventListener('click', async () => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    window.showLoading();
    const selectedColor = currentSelectedOptions.color ? currentSelectedOptions.color.value : null;
    const selectedStorage = currentSelectedOptions.storage ? currentSelectedOptions.storage.value : null;

    const existingCartItemIndex = window.userCartCache.findIndex(item =>
        item.productId === currentSelectedProduct.id &&
        (item.selectedColor ? item.selectedColor.value === selectedColor : !selectedColor) &&
        (item.selectedStorage ? item.selectedStorage.value === selectedStorage : !selectedStorage)
    );

    if (existingCartItemIndex > -1) {
        window.userCartCache[existingCartItemIndex].quantity += 1;
    } else {
        window.userCartCache.push({
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
    window.hideLoading();
    window.showMessage('Đã thêm sản phẩm vào giỏ hàng!', 'success');
});

async function updateCart(itemIndex, newQuantity) {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để cập nhật giỏ hàng.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    if (newQuantity <= 0) {
        window.userCartCache.splice(itemIndex, 1);
    } else {
        window.userCartCache[itemIndex].quantity = newQuantity;
    }
    await saveUserCart();
    renderCart();
    updateCartCount();
}

async function renderCart(searchTerm = '') {
    cartItemsList.innerHTML = '';
    let totalAmount = 0;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const filteredCart = window.userCartCache.filter(item =>
        item.productName.toLowerCase().includes(lowerCaseSearchTerm)
    );

    if (filteredCart.length === 0) {
        cartItemsList.innerHTML = '<p class="text-gray-500 italic text-center">Giỏ hàng trống.</p>';
        cartTotalAmountSpan.textContent = window.formatCurrency(0);
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
                <p class="text-md text-gray-700">Giá (chưa VAT): ${window.formatCurrency(item.priceAtAddToCart)}</p>
                <p class="text-md text-gray-700">VAT (khách trả): ${window.formatCurrency(itemCustomerVATPortion)}</p>
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

    cartTotalAmountSpan.textContent = window.formatCurrency(totalAmount);

    document.querySelectorAll('.quantity-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            const action = e.target.dataset.action;
            let newQuantity = window.userCartCache[index].quantity;
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
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để mua hàng.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    if (window.userCartCache.length === 0) {
        window.showMessage('Giỏ hàng của bạn đang trống.', 'info');
        return;
    }
    productsToOrder = window.userCartCache.map(item => ({
        product: window.shopDataCache.products.find(p => p.id === item.productId),
        options: {
            color: item.selectedColor,
            storage: item.selectedStorage
        },
        quantity: 1,
        priceAtOrder: item.priceAtAddToCart,
        originalPriceForVAT: item.originalPriceForVAT,
        voucher: null
    }));
    isBuyNowFlow = false;
    window.openModal(orderCreationModal);
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
    orderIdDisplay.textContent = window.generateId();
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
                <p class="text-sm text-gray-600">Số lượng: ${item.quantity} x ${window.formatCurrency(item.priceAtOrder)} (Giá sản phẩm)</p>
                <p class="text-sm text-gray-600">VAT (khách trả): ${window.formatCurrency(itemCustomerVATPortion)}</p>
            </div>
            <span class="font-bold text-gray-900">${window.formatCurrency(itemTotalPrice)}</span>
        `;
        orderProductsSummary.appendChild(productSummaryDiv);
    });

    const totalDiv = document.createElement('div');
    totalDiv.className = 'flex justify-between items-center border-t pt-2 mt-2 font-bold text-lg';
    totalDiv.innerHTML = `<span>Tổng cộng:</span><span>${window.formatCurrency(totalOrderPrice)}</span>`;
    orderProductsSummary.appendChild(totalDiv);

    customerNameInput.value = window.loggedInUser.fullname || '';
    customerPhoneInput.value = window.loggedInUser.phone || '';
    customerAddressInput.value = window.loggedInUser.province || '';
    orderLocationInput.value = DEFAULT_WAREHOUSE_ADDRESS;

    const today = new Date();
    today.setDate(today.getDate() + 3);
    estimatedDeliveryDateInput.value = today.toISOString().split('T')[0];

    orderStatusSteps.forEach(step => step.classList.remove('active'));
    document.querySelector('.order-status-step[data-status="created"]').classList.add('active');
}

orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để tạo đơn hàng.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    window.showLoading();

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
            window.showMessage(`Sản phẩm "${product.name}" (${item.options.color?.value || ''} ${item.options.storage?.value || ''}) không đủ số lượng. Chỉ còn ${selectedVariant.quantity} sản phẩm.`, 'error');
            window.hideLoading();
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
        window.hideLoading();
        return;
    }

    const newOrder = {
        id: orderId,
        userId: window.loggedInUser.id,
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
        warrantyPaymentStatus: 'pending'
    };

    try {
        await setDoc(doc(window.db, `artifacts/${appId}/users/${window.loggedInUser.id}/orders`, newOrder.id), newOrder);
        console.log(`Order ${newOrder.id} saved to user's collection.`);

        await setDoc(doc(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), newOrder.id), { ...newOrder, customerUserId: window.loggedInUser.id });
        console.log(`Order ${newOrder.id} saved to admin collection.`);


        for (const item of productsToOrder) {
            const productIndex = window.shopDataCache.products.findIndex(p => p.id === item.product.id);
            if (productIndex > -1) {
                const selectedColor = item.options.color ? item.options.color.value : null;
                const selectedStorage = item.options.storage ? item.options.storage.value : null;
                const variantIndex = window.shopDataCache.products[productIndex].variants.findIndex(v =>
                    v.color === selectedColor && v.storage === selectedStorage
                );
                if (variantIndex > -1) {
                    window.shopDataCache.products[productIndex].variants[variantIndex].quantity -= item.quantity;
                    window.shopDataCache.products[productIndex].variants[variantIndex].sold = (window.shopDataCache.products[productIndex].variants[variantIndex].sold || 0) + item.quantity;
                }
            }
        }
        await window.saveShopData();
        console.log("Shop data (product quantities) updated.");

        if (!isBuyNowFlow) {
            window.userCartCache = [];
            await saveUserCart();
            updateCartCount();
        }

        window.hideLoading();
        window.showMessage('Đơn hàng đã được tạo thành công!', 'success');
        window.closeModal(orderCreationModal);
        window.closeModal(productDetailModal);
        renderOrders('created');
    } catch (error) {
        window.hideLoading();
        console.error("Error creating order:", error);
        window.showMessage(`Lỗi khi tạo đơn hàng: ${error.message}`, 'error');
    }
});

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
    window.showLoading();

    try {
        let orders = [];
        if (window.loggedInUser && window.loggedInUser.isAdmin) {
            const q = query(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), where('status', '==', status));
            const querySnapshot = await getDocs(q);
            orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`Admin orders for status ${status}:`, orders);
        } else if (window.loggedInUser && window.loggedInUser.id) {
            const q = query(collection(window.db, `artifacts/${appId}/users/${window.loggedInUser.id}/orders`), where('status', '==', status));
            const querySnapshot = await getDocs(q);
            orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`User ${window.loggedInUser.id} orders for status ${status}:`, orders);
        } else {
            orderListElement.innerHTML = '<p class="text-gray-500 italic text-center">Vui lòng đăng nhập để xem đơn hàng của bạn.</p>';
            window.hideLoading();
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
                    <p class="text-gray-700 mb-2"><strong>Tổng tiền:</strong> ${window.formatCurrency(order.totalAmount)}</p>
                    <p class="text-gray-700 mb-2"><strong>VAT (Khách trả):</strong> ${window.formatCurrency(order.totalVATCustomerPays)} (${order.vatPaymentStatus === 'paid' ? 'Đã thanh toán' : (order.vatPaymentStatus === 'pending_admin' ? 'Đang xác nhận thanh toán' : 'Chưa thanh toán')})</p>
                    <p class="text-gray-700 mb-2"><strong>VAT (Shop đã hỗ trợ thanh toán cho khách hàng ):</strong> ${window.formatCurrency(order.totalShopSupportVAT)}</p>
                    <p class="text-gray-700 mb-2"><strong>Gói bảo hành:</strong> ${order.warrantyPackage ? `${order.warrantyPackage.name} (${window.formatCurrency(order.warrantyPackage.price - (order.warrantyPackage.price * order.warrantyPackage.discount / 100))})` : 'Chưa đăng ký'}</p>
                    <p class="text-gray-700 mb-4"><strong>Trạng thái bảo hành:</strong> ${order.warrantyPackage ? (order.warrantyPaymentStatus === 'paid' ? 'Đã thanh toán' : (order.warrantyPaymentStatus === 'pending_admin' ? 'Đang xác nhận thanh toán' : 'Chờ xác nhận')) : 'Miễn phí đổi trả trong 30 ngày'}</p>
                    <p class="text-red-600 font-bold mb-2">Thanh toán khi nhận hàng: ${window.formatCurrency(order.totalAmount - order.totalVATCustomerPays)}</p>

                    <div class="order-expandable-content" id="order-items-${order.id}">
                        <h5 class="font-semibold text-gray-800 mb-2">Sản phẩm:</h5>
                        ${(order.items || []).map(item => `
                            <div class="flex items-center space-x-3 mb-1 text-sm">
                                <img src="${item.productImage}" onerror="this.onerror=null;this.src='https://placehold.co/40x40/cccccc/333333?text=SP';" class="w-10 h-10 object-cover rounded-md">
                                <p class="flex-1">${item.productName} ${item.selectedColor ? `(${item.selectedColor.value})` : ''} ${item.selectedStorage ? `(${item.selectedStorage.value})` : ''} x ${item.quantity}</p>
                                <span class="font-semibold">${window.formatCurrency((item.priceAtOrder + item.customerVATPortion) * item.quantity)}</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="toggle-order-details-btn text-blue-600 hover:underline text-sm mt-2">Xem chi tiết sản phẩm</button>
                    <div class="mt-4 flex flex-wrap gap-2">
                        ${window.loggedInUser && window.loggedInUser.isAdmin ? `
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
                    window.showConfirmModal('Bạn có chắc chắn muốn hủy đơn hàng này?', async (confirmed) => {
                        if (confirmed) {
                            await deleteOrder(orderId, customerUserId);
                        }
                    });
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
                        window.openModal(editShippingOrderModal);
                    }
                });
            });

            document.querySelectorAll('.pay-vat-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    if (!window.loggedInUser || !window.loggedInUser.id) {
                        window.showMessage('Vui lòng đăng nhập để thanh toán VAT.', 'info');
                        window.openModal(loginRegisterModal);
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
                    if (!window.loggedInUser || !window.loggedInUser.id) {
                        window.showMessage('Vui lòng đăng nhập để mua gói bảo hành.', 'info');
                        window.openModal(loginRegisterModal);
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
                    window.showMessage('Chức năng đổi/trả đang được phát triển.', 'info');
                });
            });
        }
    } catch (error) {
        console.error("Error rendering orders:", error);
        window.showMessage(`Lỗi khi tải đơn hàng: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
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
    window.showLoading();
    try {
        const adminOrderRef = doc(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        const adminOrderSnap = await getDoc(adminOrderRef);
        if (!adminOrderSnap.exists()) {
            window.showMessage('Không tìm thấy đơn hàng.', 'error');
            window.hideLoading();
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
            window.showMessage('Hành động không hợp lệ cho trạng thái đơn hàng hiện tại.', 'error');
            window.hideLoading();
            return;
        }

        const userOrderRef = doc(window.db, `artifacts/${appId}/users/${customerUserId}/orders`, orderId);
        await updateDoc(userOrderRef, updates);
        console.log(`Order ${orderId} status updated to ${newStatus} in user's collection.`);

        await updateDoc(adminOrderRef, updates);
        console.log(`Order ${orderId} status updated to ${newStatus} in admin collection.`);

        window.showMessage(`Đơn hàng #${orderId} đã được chuyển sang trạng thái "${newStatus}".`, 'success');
        renderOrders('created');
        renderOrders('shipping');
        renderOrders('delivered');
    } catch (error) {
        console.error("Error updating order status:", error);
        window.showMessage(`Lỗi cập nhật trạng thái đơn hàng: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
}

async function deleteOrder(orderId, customerUserId) {
    window.showLoading();
    try {
        const userOrderRef = doc(window.db, `artifacts/${appId}/users/${customerUserId}/orders`, orderId);
        await deleteDoc(userOrderRef);
        console.log(`Order ${orderId} deleted from user's collection.`);

        const adminOrderRef = doc(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        await deleteDoc(adminOrderRef);
        console.log(`Order ${orderId} deleted from admin collection.`);

        window.showMessage(`Đơn hàng #${orderId} đã được hủy thành công.`, 'success');
        renderOrders('created');
        renderOrders('shipping');
        renderOrders('delivered');
    } catch (error) {
        console.error("Error deleting order:", error);
        window.showMessage(`Lỗi khi hủy đơn hàng: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
}

editShippingOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Chờ admin kiểm duyệt', 'info');
        return;
    }
    window.showLoading();
    const orderId = editShippingOrderHiddenId.value;
    const newLocation = editOrderLocationInput.value.trim();
    const newEstimatedDate = editEstimatedDeliveryDateInput.value;

    try {
        const adminOrderRef = doc(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        const adminOrderSnap = await getDoc(adminOrderRef);
        if (!adminOrderSnap.exists()) {
            window.showMessage('Không tìm thấy đơn hàng để cập nhật.', 'error');
            window.hideLoading();
            return;
        }
        const orderData = adminOrderSnap.data();
        const customerUserId = orderData.userId;

        const userOrderRef = doc(window.db, `artifacts/${appId}/users/${customerUserId}/orders`, orderId);
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

        window.showMessage('Cập nhật thông tin vận chuyển thành công!', 'success');
        window.closeModal(editShippingOrderModal);
        renderOrders('shipping');
    } catch (error) {
        console.error("Error updating shipping info:", error);
        window.showMessage(`Lỗi cập nhật thông tin vận chuyển: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
});

function renderProductManagementList() {
    productManagementList.innerHTML = '';
    if (window.shopDataCache.products.length === 0) {
        productManagementList.innerHTML = '<p class="text-gray-500 italic">Chưa có sản phẩm nào.</p>';
        return;
    }
    window.shopDataCache.products.forEach(product => {
        const productDiv = document.createElement('div');
        productDiv.className = 'flex items-center justify-between bg-gray-100 p-3 rounded-lg shadow-sm';
        productDiv.innerHTML = `
            <div class="flex items-center space-x-3">
                <img src="${product.image}" onerror="this.onerror=null;this.src='https://placehold.co/60x60/cccccc/333333?text=SP';" class="w-16 h-16 object-cover rounded-md">
                <div>
                    <p class="font-semibold text-gray-900">${product.name}</p>
                    <p class="text-sm text-gray-600">${window.formatCurrency(product.basePrice)}</p>
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
            if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
                window.showMessage('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const productId = e.target.dataset.productId;
            copyProduct(productId);
        });
    });

    document.querySelectorAll('.edit-product-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
                window.showMessage('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const productId = e.target.dataset.productId;
            editProduct(productId);
        });
    });

    document.querySelectorAll('.delete-product-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
                window.showMessage('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const productId = e.target.dataset.productId;
            window.showConfirmModal('Bạn có chắc chắn muốn xóa sản phẩm này?', async (confirmed) => {
                if (confirmed) {
                    await deleteProduct(productId);
                }
            });
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
    colorOptionsContainer.innerHTML = '';
    storageOptionsContainer.innerHTML = '';
    variantsContainer.innerHTML = '';
    submitProductBtn.textContent = 'Thêm Sản Phẩm';
    cancelEditBtn.classList.add('hidden');
}

function copyProduct(productId) {
    const product = window.shopDataCache.products.find(p => p.id === productId);
    if (!product) {
        window.showMessage('Không tìm thấy sản phẩm để sao chép.', 'error');
        return;
    }

    const copiedProduct = JSON.parse(JSON.stringify(product));
    copiedProduct.id = window.generateId();
    copiedProduct.name = `Bản sao của ${product.name}`;

    copiedProduct.variants.forEach(variant => {
        variant.sold = 0;
    });

    window.shopDataCache.products.push(copiedProduct);
    window.showMessage('Đã sao chép sản phẩm. Vui lòng chỉnh sửa và lưu.', 'success');
    editProduct(copiedProduct.id);
}

addEditProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Chờ admin kiểm duyệt', 'info');
        return;
    }
    window.showLoading();

    const productId = editProductIdInput.value;
    const name = newProductNameInput.value.trim();
    const basePrice = parseFloat(newProductBasePriceInput.value);
    const image = newProductImageInput.value.trim();
    const description = newProductDescriptionInput.value.trim();
    const reviewsCount = parseInt(newProductReviewsInput.value);

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
        colors,
        storages,
        variants
    };

    if (productId) {
        const index = window.shopDataCache.products.findIndex(p => p.id === productId);
        if (index > -1) {
            window.shopDataCache.products[index] = { ...window.shopDataCache.products[index], ...newProduct };
        }
        window.showMessage('Sản phẩm đã được cập nhật!', 'success');
        console.log(`Product ${productId} updated.`);
    } else {
        newProduct.id = window.generateId();
        window.shopDataCache.products.push(newProduct);
        window.showMessage('Sản phẩm đã được thêm!', 'success');
        console.log("New product added:", newProduct);
    }
    await window.saveShopData();
    resetAddEditProductForm();
    window.hideLoading();
});

async function editProduct(productId) {
    const product = window.shopDataCache.products.find(p => p.id === productId);
    if (!product) {
        window.showMessage('Không tìm thấy sản phẩm.', 'error');
        return;
    }

    addEditProductTitle.textContent = 'Chỉnh Sửa Sản Phẩm';
    editProductIdInput.value = product.id;
    newProductNameInput.value = product.name;
    newProductBasePriceInput.value = product.basePrice;
    newProductImageInput.value = product.image;
    newProductDescriptionInput.value = product.description;
    newProductReviewsInput.value = product.reviewsCount;

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
    window.showLoading();
    try {
        window.shopDataCache.products = window.shopDataCache.products.filter(p => p.id !== productId);
        await window.saveShopData();
        window.showMessage('Sản phẩm đã được xóa!', 'success');
        console.log(`Product ${productId} deleted.`);
    } catch (error) {
        console.error("Error deleting product:", error);
        window.showMessage(`Lỗi khi xóa sản phẩm: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
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
    const vouchers = Object.entries(window.shopDataCache.vouchers);
    if (vouchers.length === 0) {
        currentVouchersList.innerHTML = '<p class="text-gray-500 italic">Chưa có voucher nào.</p>';
        return;
    }
    vouchers.forEach(([code, voucherData]) => {
        const voucherDiv = document.createElement('div');
        voucherDiv.className = 'flex items-center justify-between bg-gray-100 p-3 rounded-lg shadow-sm';
        const expiryDate = new Date(voucherData.expiry);
        const now = new Date();
        const isExpired = expiryDate <= now;
        const expiryText = isExpired ? 'Đã hết hạn' : `Hết hạn: ${expiryDate.toLocaleString('vi-VN')}`;
        const expiryColorClass = isExpired ? 'text-red-500' : 'text-green-600';
        const isAdminVoucherTag = voucherData.isAdminVoucher ? '<span class="ml-2 px-2 py-1 bg-indigo-200 text-indigo-800 rounded-full text-xs font-semibold">Admin</span>' : '';

        voucherDiv.innerHTML = `
            <p class="font-semibold text-gray-900">${code}: ${voucherData.displayValue} <span class="${expiryColorClass}">(${expiryText})</span> ${isAdminVoucherTag}</p>
            <button class="delete-voucher-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-voucher-code="${code}">Xóa</button>
        `;
        currentVouchersList.appendChild(voucherDiv);
    });

    document.querySelectorAll('.delete-voucher-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
                window.showMessage('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const voucherCode = e.target.dataset.voucherCode;
            window.showConfirmModal('Bạn có chắc chắn muốn xóa voucher này?', async (confirmed) => {
                if (confirmed) {
                    await deleteVoucher(voucherCode);
                }
            });
        });
    });
}

addVoucherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Chờ admin kiểm duyệt', 'info');
        return;
    }
    window.showLoading();
    const code = newVoucherCodeInput.value.trim().toUpperCase();
    let valueInput = newVoucherValueInput.value.trim();
    const expiryInput = newVoucherExpiryInput.value.trim();

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
            window.showMessage('Giá trị voucher không hợp lệ.', 'error');
            window.hideLoading();
            return;
        }
        if (voucherValue < 1) {
            voucherType = 'percentage';
            displayValue = `${voucherValue * 100}%`;
        } else {
            voucherType = 'fixed';
            displayValue = window.formatCurrency(voucherValue);
        }
    }

    if (!expiryInput) {
        window.showMessage('Vui lòng nhập thời gian hết hạn cho voucher.', 'error');
        window.hideLoading();
        return;
    }
    const expiryDate = new Date(expiryInput);
    if (isNaN(expiryDate.getTime())) {
        window.showMessage('Định dạng thời gian hết hạn không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD HH:MM:SS.', 'error');
        window.hideLoading();
        return;
    }

    window.shopDataCache.vouchers[code] = {
        value: voucherValue,
        type: voucherType,
        expiry: expiryDate.toISOString(),
        displayValue: displayValue,
        isAdminVoucher: false
    };
    await window.saveShopData();
    newVoucherCodeInput.value = '';
    newVoucherValueInput.value = '';
    newVoucherExpiryInput.value = '';
    window.hideLoading();
});

addAdminVoucherForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Bạn không có quyền thêm voucher Admin.', 'info');
        return;
    }
    window.showLoading();
    const code = newAdminVoucherCodeInput.value.trim().toUpperCase();
    const type = newAdminVoucherTypeSelect.value;
    let valueInput = newAdminVoucherValueInput.value.trim();
    const expiryInput = newAdminVoucherExpiryInput.value.trim();

    let voucherValue;
    let displayValue;

    if (type === 'freeship') {
        voucherValue = 'freeship';
        displayValue = 'Miễn phí vận chuyển';
    } else if (type === 'spin') {
        voucherValue = parseInt(valueInput, 10);
        if (isNaN(voucherValue) || voucherValue <= 0) {
            window.showMessage('Số lượt quay phải là một số nguyên dương.', 'error');
            window.hideLoading();
            return;
        }
        displayValue = `${voucherValue} lượt quay`;
    }
    else {
        voucherValue = parseFloat(valueInput);
        if (isNaN(voucherValue)) {
            window.showMessage('Giá trị voucher không hợp lệ.', 'error');
            window.hideLoading();
            return;
        }
        if (voucherValue < 1) {
            displayValue = `${voucherValue * 100}%`;
        } else {
            displayValue = window.formatCurrency(voucherValue);
        }
    }

    if (!expiryInput) {
        window.showMessage('Vui lòng nhập thời gian hết hạn cho voucher.', 'error');
        window.hideLoading();
        return;
    }
    const expiryDate = new Date(expiryInput);
    if (isNaN(expiryDate.getTime())) {
        window.showMessage('Định dạng thời gian hết hạn không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD HH:MM:SS.', 'error');
        window.hideLoading();
        return;
    }

    window.shopDataCache.vouchers[code] = {
        value: voucherValue,
        type: type,
        expiry: expiryDate.toISOString(),
        displayValue: displayValue,
        isAdminVoucher: true
    };
    await window.saveShopData();
    newAdminVoucherCodeInput.value = '';
    newAdminVoucherTypeSelect.value = 'percentage';
    newAdminVoucherValueInput.value = '';
    newAdminVoucherExpiryInput.value = '';
    window.hideLoading();
    window.showMessage('Voucher Admin đã được thêm!', 'success');
});

// Admin Voucher Type change listener
if (newAdminVoucherTypeSelect) {
    newAdminVoucherTypeSelect.addEventListener('change', () => {
        if (newAdminVoucherTypeSelect.value === 'freeship') {
            newAdminVoucherValueInput.value = 'freeship';
            newAdminVoucherValueInput.placeholder = 'Miễn phí vận chuyển (Tự động)';
            newAdminVoucherValueInput.type = 'text';
            newAdminVoucherValueInput.min = '';
            newAdminVoucherValueInput.readOnly = true; // Make it read-only
            adminVoucherValueContainer.classList.remove('hidden');
        } else if (newAdminVoucherTypeSelect.value === 'spin') {
            newAdminVoucherValueInput.value = '';
            newAdminVoucherValueInput.placeholder = 'Số lượt quay (ví dụ: 1, 5, 10)';
            newAdminVoucherValueInput.type = 'number';
            newAdminVoucherValueInput.min = '1';
            newAdminVoucherValueInput.readOnly = false; // Make it editable
            adminVoucherValueContainer.classList.remove('hidden');
        }
        else {
            newAdminVoucherValueInput.value = '';
            newAdminVoucherValueInput.placeholder = 'Giá Trị Voucher (ví dụ: 0.10 cho 10%, 50000 cho 50.000 VND)';
            newAdminVoucherValueInput.type = 'number';
            newAdminVoucherValueInput.min = '0';
            newAdminVoucherValueInput.readOnly = false;
            adminVoucherValueContainer.classList.remove('hidden');
        }
    });
    newAdminVoucherTypeSelect.dispatchEvent(new Event('change')); // Set initial state
}


async function deleteVoucher(code) {
    window.showLoading();
    try {
        delete window.shopDataCache.vouchers[code];
        await window.saveShopData();
        console.log(`Voucher ${code} deleted.`);
    } catch (error) {
        console.error("Error deleting voucher:", error);
        window.showMessage(`Lỗi khi xóa voucher: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
}

async function renderWarrantyPackagesList() {
    warrantyPackagesSelection.innerHTML = '';
    currentWarrantyPackagesList.innerHTML = '';
    if (window.shopDataCache.warrantyPackages.length === 0) {
        currentWarrantyPackagesList.innerHTML = '<p class="text-gray-500 italic">Chưa có gói bảo hành nào được cấu hình.</p>';
        warrantyPackagesSelection.innerHTML = '<p class="text-gray-500 italic">Chưa có gói bảo hành nào để chọn.</p>';
        return;
    }

    window.shopDataCache.warrantyPackages.forEach(pkg => {
        const packageDiv = document.createElement('div');
        packageDiv.className = 'flex items-center justify-between bg-gray-100 p-3 rounded-lg shadow-sm';
        packageDiv.innerHTML = `
            <div>
                <p class="font-semibold text-gray-900">${pkg.name}</p>
                <p class="text-sm text-gray-600">Giá: ${window.formatCurrency(pkg.price)} - Giảm: ${pkg.discount}%</p>
            </div>
            <div class="flex space-x-2">
                <button class="edit-warranty-package-btn bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-package-id="${pkg.id}">Sửa</button>
                <button class="delete-warranty-package-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-3 rounded-lg transition-all duration-200" data-package-id="${pkg.id}">Xóa</button>
            </div>
        `;
        currentWarrantyPackagesList.appendChild(packageDiv);
    });

    window.shopDataCache.warrantyPackages.forEach(pkg => {
        const packageCard = document.createElement('div');
        packageCard.className = 'warranty-package-card cursor-pointer';
        packageCard.dataset.packageId = pkg.id;
        packageCard.innerHTML = `
            <h4 class="font-semibold text-lg text-gray-900">${pkg.name}</h4>
            <p class="text-gray-700">Giá sản phẩm: <span class="font-bold">${window.formatCurrency(pkg.price)}</span></p>
            ${pkg.discount > 0 ? `<p class="text-green-600">Giảm giá: ${pkg.discount}%</p>` : ''}
            <p class="text-xl font-bold text-blue-700">Giá cuối: ${window.formatCurrency(pkg.price - (pkg.price * pkg.discount / 100))}</p>
        `;
        warrantyPackagesSelection.appendChild(packageCard);

        packageCard.addEventListener('click', () => {
            document.querySelectorAll('.warranty-package-card').forEach(card => {
                card.classList.remove('selected-package');
            });
            packageCard.classList.add('selected-package');
            selectedWarrantyPackage = pkg;
            const finalPrice = pkg.price - (pkg.price * pkg.discount / 100);
            warrantyPaymentTotal.textContent = window.formatCurrency(finalPrice);
            confirmWarrantyPaymentBtn.disabled = false;
            confirmWarrantyPaymentBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
    });


    document.querySelectorAll('.edit-warranty-package-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
                window.showMessage('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const packageId = e.target.dataset.packageId;
            editWarrantyPackage(packageId);
        });
    });

    document.querySelectorAll('.delete-warranty-package-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
                window.showMessage('Chờ admin kiểm duyệt', 'info');
                return;
            }
            const packageId = e.target.dataset.packageId;
            window.showConfirmModal('Bạn có chắc chắn muốn xóa gói bảo hành này?', async (confirmed) => {
                if (confirmed) {
                    await deleteWarrantyPackage(packageId);
                }
            });
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
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Chờ admin kiểm duyệt', 'info');
        return;
    }
    window.showLoading();

    const packageId = editWarrantyPackageIdInput.value;
    const name = newWarrantyPackageNameInput.value.trim();
    const price = parseFloat(newWarrantyPackagePriceInput.value);
    const discount = parseFloat(newWarrantyPackageDiscountInput.value);

    const newPackage = {
        id: packageId || window.generateId(),
        name,
        price,
        discount
    };

    if (packageId) {
        const index = window.shopDataCache.warrantyPackages.findIndex(p => p.id === packageId);
        if (index > -1) {
            window.shopDataCache.warrantyPackages[index] = newPackage;
        }
        window.showMessage('Gói bảo hành đã được cập nhật!', 'success');
        console.log(`Warranty package ${packageId} updated.`);
    } else {
        window.shopDataCache.warrantyPackages.push(newPackage);
        window.showMessage('Gói bảo hành đã được thêm!', 'success');
        console.log("New warranty package added:", newPackage);
    }
    await window.saveShopData();
    renderWarrantyPackagesList();
    resetAddEditWarrantyPackageForm();
    window.hideLoading();
});

function editWarrantyPackage(packageId) {
    const pkg = window.shopDataCache.warrantyPackages.find(p => p.id === packageId);
    if (!pkg) {
        window.showMessage('Không tìm thấy gói bảo hành.', 'error');
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
    window.showLoading();
    try {
        window.shopDataCache.warrantyPackages = window.shopDataCache.warrantyPackages.filter(p => p.id !== packageId);
        await window.saveShopData();
        renderWarrantyPackagesList();
        console.log(`Warranty package ${packageId} deleted.`);
    }
    catch (error) {
        console.error("Error deleting warranty package:", error);
        window.showMessage(`Lỗi khi xóa gói bảo hành: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
}

async function generateShopReport() {
    window.showLoading();
    let allOrders = [];
    try {
        if (window.loggedInUser && window.loggedInUser.isAdmin) {
            const querySnapshot = await getDocs(collection(window.db, `artifacts/${appId}/public/data/adminOrders`));
            allOrders = querySnapshot.docs.map(doc => doc.data());
            console.log("Admin fetched all orders for report:", allOrders);
        } else if (window.loggedInUser && window.loggedInUser.id) {
            const querySnapshot = await getDocs(collection(window.db, `artifacts/${appId}/users/${window.loggedInUser.id}/orders`));
            allOrders = querySnapshot.docs.map(doc => doc.data());
            console.log(`User ${window.loggedInUser.id} fetched orders for report:`, allOrders);
        } else {
            totalRevenueDisplay.textContent = window.formatCurrency(0);
            totalOrdersDisplay.textContent = 0;
            topSellingProductsList.innerHTML = '<li class="italic text-gray-500">Vui lòng đăng nhập để xem báo cáo.</li>';
            window.hideLoading();
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

        totalRevenueDisplay.textContent = window.formatCurrency(totalRevenue);
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
        window.showMessage(`Lỗi khi tạo báo cáo: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
}

generateReportBtn.addEventListener('click', generateShopReport);

function displayPaymentVATModal(order) {
    qrCodeDisplay.src = window.shopDataCache.bankDetails.qrCodeImage || 'https://placehold.co/200x200/cccccc/333333?text=QR+Code';
    bankNameDisplay.textContent = window.shopDataCache.bankDetails.bankName || 'N/A';
    accountNumberDisplay.textContent = window.shopDataCache.bankDetails.accountNumber || 'N/A';
    accountHolderDisplay.textContent = window.shopDataCache.bankDetails.accountHolder || 'N/A';

    vatBaseAmountDisplay.textContent = window.formatCurrency(order.totalOriginalProductPrice);

    const shopSupportAmount = order.totalOriginalProductPrice * 0.08;
    if (shopSupportVatDisplay) {
        shopSupportVatDisplay.textContent = window.formatCurrency(shopSupportAmount);
    }

    const totalVATOriginalAmount = order.totalOriginalProductPrice * 0.10;
    if (totalVatOriginalDisplay) {
        totalVatOriginalDisplay.textContent = window.formatCurrency(totalVATOriginalAmount);
    }

    const customerPaysAmount = order.totalOriginalProductPrice * 0.02;
    paymentModalVATTotal.textContent = window.formatCurrency(customerPaysAmount);

    paymentAmountInput.value = customerPaysAmount;
    amountPaidDisplay.textContent = window.formatCurrency(0);
    remainingPaymentDisplay.textContent = window.formatCurrency(customerPaysAmount);

    paymentAmountInput.disabled = true;

    paymentAmountInput.oninput = () => {
        const paidAmount = parseFloat(paymentAmountInput.value) || 0;
        const remaining = customerPaysAmount - paidAmount;
        amountPaidDisplay.textContent = window.formatCurrency(paidAmount);
        remainingPaymentDisplay.textContent = window.formatCurrency(remaining);
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

    if (window.loggedInUser && window.loggedInUser.isAdmin) {
        confirmPaymentBtn.classList.add('hidden');
        adminConfirmVatPaymentBtn.classList.remove('hidden');
    } else {
        confirmPaymentBtn.classList.remove('hidden');
        adminConfirmVatPaymentBtn.classList.add('hidden');
    }

    window.openModal(paymentVATModal);
}

confirmPaymentBtn.addEventListener('click', async () => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để thanh toán.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    if (window.loggedInUser && window.loggedInUser.isAdmin) {
        window.showMessage('Admin không cần thực hiện thanh toán này, vui lòng dùng nút "Admin Xác Nhận".', 'info');
        return;
    }
    window.showLoading();
    try {
        const orderId = currentOrderForPayment.id;
        const orderRef = doc(window.db, `artifacts/${appId}/users/${window.loggedInUser.id}/orders`, orderId);
        await updateDoc(orderRef, { vatPaymentStatus: 'pending_admin' });
        console.log(`VAT payment for order ${orderId} set to pending_admin for user.`);

        const adminOrderRef = doc(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        const adminOrderSnap = await getDoc(adminOrderRef);
        if (adminOrderSnap.exists()) {
            await updateDoc(adminOrderRef, { vatPaymentStatus: 'pending_admin' });
            console.log(`VAT payment for order ${orderId} set to pending_admin for admin.`);
        }

        window.showMessage('Yêu cầu thanh toán VAT của bạn đang chờ admin xác nhận!', 'info');
        window.closeModal(paymentVATModal);
        renderOrders(currentOrderForPayment.status);
    } catch (error) {
        console.error("Error confirming VAT payment:", error);
        window.showMessage(`Lỗi khi xác nhận thanh toán VAT: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
});

adminConfirmVatPaymentBtn.addEventListener('click', async () => {
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Bạn không có quyền xác nhận thanh toán này.', 'error');
        return;
    }
    window.showLoading();
    try {
        const orderId = currentOrderForPayment.id;
        const orderRef = doc(window.db, `artifacts/${appId}/users/${currentOrderForPayment.userId}/orders`, orderId);
        await updateDoc(orderRef, { vatPaymentStatus: 'paid' });
        console.log(`VAT payment for order ${orderId} set to paid for user.`);

        const adminOrderRef = doc(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        await updateDoc(adminOrderRef, { vatPaymentStatus: 'paid' });
        console.log(`VAT payment for order ${orderId} set to paid for admin.`);

        window.showMessage(`Đã xác nhận thanh toán VAT cho đơn hàng #${orderId}.`, 'success');
        window.closeModal(paymentVATModal);
        renderOrders(currentOrderForPayment.status);
    } catch (error) {
        console.error("Error admin confirming VAT payment:", error);
        window.showMessage(`Lỗi khi admin xác nhận thanh toán VAT: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
});

function displayPaymentWarrantyModal(order) {
    selectedWarrantyPackage = null;
    warrantyPaymentTotal.textContent = window.formatCurrency(0);
    confirmWarrantyPaymentBtn.disabled = true;
    confirmWarrantyPaymentBtn.classList.add('opacity-50', 'cursor-not-allowed');

    document.querySelectorAll('.warranty-package-card').forEach(card => {
        card.classList.remove('selected-package');
    });

    qrCodeDisplayWarranty.src = window.shopDataCache.bankDetails.qrCodeImage || 'https://placehold.co/200x200/cccccc/333333?text=QR+Code';
    bankNameDisplayWarranty.textContent = window.shopDataCache.bankDetails.bankName || 'N/A';
    accountNumberDisplayWarranty.textContent = window.shopDataCache.bankDetails.accountNumber || 'N/A';
    accountHolderDisplayWarranty.textContent = window.shopDataCache.bankDetails.accountHolder || 'N/A';

    if (window.loggedInUser && window.loggedInUser.isAdmin) {
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

    window.openModal(paymentWarrantyModal);
}

confirmWarrantyPaymentBtn.addEventListener('click', async () => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để mua gói bảo hành.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    if (window.loggedInUser.isAdmin) {
        window.showMessage('Admin không cần thực hiện thanh toán này, vui lòng dùng nút "Admin Xác Nhận".', 'info');
        return;
    }
    if (!selectedWarrantyPackage) {
        window.showMessage('Vui lòng chọn một gói bảo hành.', 'error');
        return;
    }

    window.showLoading();
    try {
        const orderId = currentOrderForWarranty.id;
        const orderRefUser = doc(window.db, `artifacts/${appId}/users/${window.loggedInUser.id}/orders`, orderId);
        const orderRefAdmin = doc(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), orderId);

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

        window.showMessage('Yêu cầu mua gói bảo hành của bạn đang chờ admin xác nhận!', 'info');
        window.closeModal(paymentWarrantyModal);
        renderOrders(currentOrderForWarranty.status);
    }
    catch (error) {
        console.error("Error confirming warranty payment:", error);
        window.showMessage(`Lỗi khi xác nhận mua gói bảo hành: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
});

adminConfirmWarrantyBtn.addEventListener('click', async () => {
    if (!window.loggedInUser || !window.loggedInUser.isAdmin) {
        window.showMessage('Bạn không có quyền xác nhận thanh toán này.', 'error');
        return;
    }
    if (!currentOrderForWarranty) {
        window.showMessage('Không có đơn hàng nào được chọn để xác nhận bảo hành.', 'error');
        return;
    }

    window.showLoading();
    try {
        const orderId = currentOrderForWarranty.id;
        const customerUserId = currentOrderForWarranty.userId;
        const orderRefUser = doc(window.db, `artifacts/${appId}/users/${customerUserId}/orders`, orderId);
        await updateDoc(orderRefUser, { warrantyPaymentStatus: 'paid' });
        console.log(`Warranty payment for order ${orderId} set to paid for user.`);

        const adminOrderRef = doc(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), orderId);
        await updateDoc(adminOrderRef, { warrantyPaymentStatus: 'paid' });
        console.log(`Warranty payment for order ${orderId} set to paid for admin.`);

        window.showMessage(`Đã xác nhận thanh toán gói bảo hành cho đơn hàng #${orderId}.`, 'success');
        window.closeModal(paymentWarrantyModal);
        renderOrders(currentOrderForWarranty.status);
    } catch (error) {
        console.error("Error admin confirming warranty payment:", error);
        window.showMessage(`Lỗi khi admin xác nhận thanh toán gói bảo hành: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
});


function displayOrderTrackingModal(order) {
    trackingShippingUnitImage.src = window.shopDataCache.shippingUnit.image || 'https://placehold.co/200x100/cccccc/333333?text=Shipping+Unit';
    trackingShippingUnitName.textContent = window.shopDataCache.shippingUnit.name || 'GHN Express';
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

    window.openModal(orderTrackingModal);
}


// Authentication and User Management
onAuthStateChanged(window.auth, async (user) => {
    if (user) {
        window.currentUserId = user.uid;
        console.log("User authenticated:", user.uid);
        const userProfileDocRef = doc(window.db, `artifacts/${appId}/users/${window.currentUserId}`);
        try {
            const userDocSnap = await getDoc(userProfileDocRef);
            if (userDocSnap.exists()) {
                window.loggedInUser = { id: window.currentUserId, ...userDocSnap.data() };
                window.loggedInUser.isAdmin = (window.loggedInUser.email === window.shopDataCache.adminEmail);
                console.log("Logged in user data:", window.loggedInUser);
            } else {
                const isUserAdmin = (user.email === window.shopDataCache.adminEmail);
                window.loggedInUser = {
                    id: window.currentUserId,
                    username: user.email || `guest_${window.currentUserId.substring(0, 8)}`,
                    fullname: '',
                    phone: '',
                    province: '',
                    isAdmin: isUserAdmin,
                    email: user.email
                };
                await setDoc(userProfileDocRef, window.loggedInUser);
                console.log("New user profile created:", window.loggedInUser);
            }

            if (!window.loggedInUser.isAdmin) {
                onSnapshot(collection(window.db, `artifacts/${appId}/users/${window.currentUserId}/orders`), (snapshot) => {
                    window.userOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log("User orders updated:", window.userOrdersCache);
                    if (window.loggedInUser) {
                        renderOrders('created');
                        renderOrders('shipping');
                        renderOrders('delivered');
                    }
                }, (error) => console.error("Error fetching user orders:", error));

                onSnapshot(doc(collection(window.db, `artifacts/${appId}/users/${window.currentUserId}/cart`), 'currentCart'), (docSnapshot) => {
                    if (docSnapshot.exists()) {
                        window.userCartCache = docSnapshot.data().items || [];
                    } else {
                        window.userCartCache = [];
                    }
                    console.log("User cart updated:", window.userCartCache);
                    updateCartCount();
                    if (cartModal.classList.contains('active')) {
                        renderCart();
                    }
                }, (error) => console.error("Error fetching user cart:", error));
            } else {
                onSnapshot(collection(window.db, `artifacts/${appId}/public/data/adminOrders`), (snapshot) => {
                    window.userOrdersCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    console.log("Admin orders updated:", window.userOrdersCache);
                    if (window.loggedInUser) {
                        renderOrders('created');
                        renderOrders('shipping');
                        renderOrders('delivered');
                    }
                }, (error) => console.error("Error fetching admin orders:", error));
            }
        } catch (error) {
            console.error("Error during user profile fetching/creation:", error);
            window.showMessage(`Lỗi tải hồ sơ người dùng: ${error.message}`, 'error');
        }
    } else {
        window.loggedInUser = { id: null, username: 'Khách', isAdmin: false, email: null, fullname: '', phone: '', province: '' };
        window.currentUserId = null;
        window.userOrdersCache = [];
        window.userCartCache = [];
        console.log("User logged out.");
    }
    updateAuthUI();
});

function updateAuthUI() {
    if (window.loggedInUser && window.loggedInUser.id) {
        loginStatusBtn.textContent = `Xin chào, ${window.loggedInUser.username || window.loggedInUser.email || 'Khách'}`;
        loginStatusBtn.onclick = logoutUser;
        openManagementModalBtn.style.display = window.loggedInUser.isAdmin ? 'block' : 'none';
        openSettingsModalBtn.style.display = window.loggedInUser.isAdmin ? 'block' : 'none';
        openShopAnalyticsModalBtn.style.display = window.loggedInUser.isAdmin ? 'block' : 'none';
        const adminVoucherSection = document.getElementById('add-admin-voucher-form').closest('.border-b.pb-6.border-gray-200');
        if (adminVoucherSection) {
            adminVoucherSection.style.display = window.loggedInUser.isAdmin ? 'block' : 'none';
        }

    } else {
        loginStatusBtn.textContent = 'Đăng nhập';
        loginStatusBtn.onclick = () => window.openModal(loginRegisterModal);
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
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.openModal(loginRegisterModal);
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

    window.showLoading();
    try {
        const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
        const user = userCredential.user;
        const isUserAdmin = (email === window.shopDataCache.adminEmail);

        await setDoc(doc(window.db, `artifacts/${appId}/users/${user.uid}`), {
            username: email,
            fullname,
            phone,
            province,
            isAdmin: isUserAdmin,
            email: email
        });
        console.log("User registered and profile created:", user.uid);

        window.showMessage('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
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
        window.hideLoading();
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

    window.showLoading();
    try {
        await signInWithEmailAndPassword(window.auth, email, password);
        window.showMessage('Đăng nhập thành công!', 'success');
        loginErrorMessage.classList.add('hidden');
        window.closeModal(loginRegisterModal);
    } catch (error) {
        console.error("Error during login:", error);
        loginErrorMessage.textContent = `Lỗi đăng nhập: ${error.message}`;
        loginErrorMessage.classList.remove('hidden');
    } finally {
        window.hideLoading();
    }
});

async function logoutUser() {
    window.showLoading();
    try {
        await signOut(window.auth);
        window.showMessage('Đã đăng xuất.', 'info');
    } catch (error) {
        console.error("Error during logout:", error);
        window.showMessage(`Lỗi đăng xuất: ${error.message}`, 'error');
    } finally {
        window.hideLoading();
    }
}

async function renderProfileModal() {
    if (window.loggedInUser) {
        profileUsernameInput.value = window.loggedInUser.username || '';
        profileFullnameInput.value = window.loggedInUser.fullname || '';
        profilePhoneInput.value = window.loggedInUser.phone || '';
        profileProvinceInput.value = window.loggedInUser.province || '';
    }
}

saveProfileBtn.addEventListener('click', async () => {
    if (!window.loggedInUser || !window.loggedInUser.id) {
        window.showMessage('Vui lòng đăng nhập để lưu hồ sơ.', 'info');
        window.openModal(loginRegisterModal);
        return;
    }
    window.showLoading();
    try {
        const profileRef = doc(window.db, `artifacts/${appId}/users/${window.loggedInUser.id}`);
        await updateDoc(profileRef, {
            fullname: profileFullnameInput.value.trim(),
            phone: profilePhoneInput.value.trim(),
            province: profileProvinceInput.value.trim()
        });
        window.loggedInUser.fullname = profileFullnameInput.value.trim();
        window.loggedInUser.phone = profilePhoneInput.value.trim();
        window.loggedInUser.province = profileProvinceInput.value.trim();
        window.showMessage('Hồ sơ đã được cập nhật!', 'success');
        console.log("User profile updated.");
    } catch (error) {
        console.error("Error updating user profile:", error);
        profileErrorMessage.textContent = `Lỗi cập nhật hồ sơ: ${error.message}`;
        profileErrorMessage.classList.remove('hidden');
    } finally {
        window.hideLoading();
    }
});

async function saveUserCart() {
    if (window.loggedInUser && window.currentUserId) {
        window.showLoading();
        try {
            await setDoc(doc(collection(window.db, `artifacts/${appId}/users/${window.currentUserId}/cart`), 'currentCart'), { items: window.userCartCache });
            console.log("User cart saved.");
        } catch (error) {
            console.error("Error saving cart:", error);
            window.showMessage("Lỗi lưu giỏ hàng.", "error");
        } finally {
            window.hideLoading();
        }
    }
}

async function updateCartCount() {
    if (window.loggedInUser && window.currentUserId) {
        try {
            const cartDocSnap = await getDoc(doc(collection(window.db, `artifacts/${appId}/users/${window.currentUserId}/cart`), 'currentCart'));
            if (cartDocSnap.exists()) {
                window.userCartCache = cartDocSnap.data().items || [];
                const totalItems = window.userCartCache.reduce((sum, item) => sum + item.quantity, 0);
                cartCountSpan.textContent = totalItems;
            } else {
                window.userCartCache = [];
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
    const address = window.shopDataCache.address;
    if (address && address !== 'Chưa cập nhật') {
        const encodedAddress = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    } else {
        window.showMessage('Vui lòng cập nhật địa chỉ cửa hàng trong cài đặt trước.', 'info');
    }
});
