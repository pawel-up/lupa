<template>
  <div v-if="showBanner" class="cookie-banner">
    <div class="cookie-content">
      <p>We don't sell your data. However, as an open-source project, our existence depends on understanding our traffic. We use a minimal Google Analytics cookie to see how these docs are used. By clicking "Accept", you're helping us keep Lupa growing!</p>
      <div class="cookie-actions">
        <button class="btn-decline" @click="decline">Decline</button>
        <button class="btn-accept" @click="accept">Accept</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showBanner = ref(false)

onMounted(() => {
  const consent = localStorage.getItem('cookie-consent')
  if (!consent) {
    showBanner.value = true
  } else if (consent === 'granted') {
    updateConsent('granted')
  }
})

const updateConsent = (state) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('consent', 'update', {
      'analytics_storage': state,
      'ad_storage': state,
      'ad_user_data': state,
      'ad_personalization': state
    })
  }
}

const accept = () => {
  localStorage.setItem('cookie-consent', 'granted')
  updateConsent('granted')
  showBanner.value = false
}

const decline = () => {
  localStorage.setItem('cookie-consent', 'denied')
  updateConsent('denied')
  showBanner.value = false
}
</script>

<style scoped>
.cookie-banner {
  position: fixed;
  bottom: 24px;
  left: 24px;
  right: 24px;
  z-index: 100;
  background-color: var(--vp-c-bg-soft, #ffffff);
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 800px;
  margin: 0 auto;
}

.dark .cookie-banner {
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.cookie-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

@media (min-width: 640px) {
  .cookie-content {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.cookie-content p {
  margin: 0;
  font-size: 14px;
  color: var(--vp-c-text-2, #3c3c43);
  line-height: 1.5;
  flex: 1;
}

.cookie-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

button {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-accept {
  background-color: var(--vp-c-brand-1, #3eaf7c);
  color: #fff;
  border: 1px solid transparent;
}

.btn-accept:hover {
  background-color: var(--vp-c-brand-2, #33a06f);
}

.btn-decline {
  background-color: transparent;
  color: var(--vp-c-text-2, #3c3c43);
  border: 1px solid var(--vp-c-divider, #e2e2e3);
}

.btn-decline:hover {
  border-color: var(--vp-c-brand-1, #3eaf7c);
  color: var(--vp-c-brand-1, #3eaf7c);
}
</style>
