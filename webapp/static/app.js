const { createApp, ref, computed, reactive, watch } = Vue;

createApp({
  setup() {
    // Reactive state
    const currentStep = ref(1);
    const error = ref(null);
    const success = ref(null);
    const uploading = ref(false);
    const invoiceData = ref(null);
    const generatingReports = ref(false);
    const testingConnection = ref(false);
    const credentialsVerified = ref(false);
    const analyzing = ref(false);
    const analysisComplete = ref(false);
    const matchResults = ref(null);
    const syncing = ref(false);
    const syncResults = ref(null);
    const showReportsModal = ref(false);
    const reports = ref(null);

    const brewfatherCredentials = reactive({
      userId: '',
      apiKey: ''
    });

    // Load credentials from localStorage on startup
    const loadCredentialsFromStorage = () => {
      try {
        const stored = localStorage.getItem('brewfatherCredentials');
        if (stored) {
          const credentials = JSON.parse(stored);
          if (credentials.userId) brewfatherCredentials.userId = credentials.userId;
          if (credentials.apiKey) brewfatherCredentials.apiKey = credentials.apiKey;
          console.log('Loaded Brewfather credentials from localStorage');
          
          // Auto-verify credentials if both are present
          if (credentials.userId && credentials.apiKey) {
            console.log('Auto-verifying stored credentials...');
            // Note: We don't auto-verify to avoid unnecessary API calls on every page load
            // User can manually test if needed
          }
        }
      } catch (error) {
        console.warn('Failed to load credentials from localStorage:', error);
      }
    };

    // Save credentials to localStorage
    const saveCredentialsToStorage = () => {
      try {
        const credentials = {
          userId: brewfatherCredentials.userId,
          apiKey: brewfatherCredentials.apiKey
        };
        localStorage.setItem('brewfatherCredentials', JSON.stringify(credentials));
        console.log('Saved Brewfather credentials to localStorage');
      } catch (error) {
        console.warn('Failed to save credentials to localStorage:', error);
      }
    };

    // Clear credentials from localStorage
    const clearCredentialsFromStorage = () => {
      try {
        localStorage.removeItem('brewfatherCredentials');
        console.log('Cleared Brewfather credentials from localStorage');
      } catch (error) {
        console.warn('Failed to clear credentials from localStorage:', error);
      }
    };

    // Helper functions for sync results display
    const getSyncSummary = () => {
      if (!syncResults.value?.results) {
        return { success: 0, notFound: 0, noMatch: 0, errors: 0 };
      }
      
      let success = 0, notFound = 0, noMatch = 0, errors = 0;
      
      Object.values(syncResults.value.results).forEach(results => {
        if (Array.isArray(results)) {
          results.forEach(result => {
            if (result.success) {
              success++;
            } else if (result.action === 'not_found') {
              notFound++;
            } else if (result.action === 'no_match') {
              noMatch++;
            } else {
              errors++;
            }
          });
        } else if (results.error) {
          errors++;
        }
      });
      
      return { success, notFound, noMatch, errors };
    };

    const getTypeIcon = (type) => {
      const icons = {
        fermentable: 'fas fa-seedling',
        hop: 'fas fa-leaf',
        yeast: 'fas fa-vial',
        misc: 'fas fa-flask'
      };
      return icons[type] || 'fas fa-box';
    };

    // Initialize credentials on app start
    loadCredentialsFromStorage();

    // Watch for credential changes to reset verification status
    watch(() => [brewfatherCredentials.userId, brewfatherCredentials.apiKey], () => {
      // Reset verification status when credentials change
      if (credentialsVerified.value) {
        credentialsVerified.value = false;
        analysisComplete.value = false;
        matchResults.value = null;
        syncResults.value = null;
      }
    });

    // Computed properties
    const ingredientsWithMatches = computed(() => {
      if (!invoiceData.value?.ingredients || !matchResults.value?.matches) return [];
      
      return invoiceData.value.ingredients.map(ingredient => {
        const match = matchResults.value.matches[ingredient.name];
        let matchStatus = 'none';
        let brewfatherMatch = null;

        if (match?.found) {
          matchStatus = match.confidence === 'high' ? 'exact' : 'partial';
          brewfatherMatch = match.brewfatherItem;
        }

        return {
          ...ingredient,
          matchStatus,
          brewfatherMatch
        };
      });
    });

    const matchSummary = computed(() => {
      if (!ingredientsWithMatches.value.length) {
        return { exactMatches: 0, partialMatches: 0, noMatches: 0 };
      }

      return ingredientsWithMatches.value.reduce((summary, ingredient) => {
        if (ingredient.matchStatus === 'exact') summary.exactMatches++;
        else if (ingredient.matchStatus === 'partial') summary.partialMatches++;
        else summary.noMatches++;
        return summary;
      }, { exactMatches: 0, partialMatches: 0, noMatches: 0 });
    });

    const hasStoredCredentials = computed(() => {
      return !!(brewfatherCredentials.userId && brewfatherCredentials.apiKey);
    });

    // Add this computed property to enhance sync results:
    const enhancedSyncResults = computed(() => {
      if (!syncResults.value) return null;
      
      const enhanced = { ...syncResults.value };
      
      // Enhance each result category
      Object.keys(enhanced.results).forEach(type => {
        if (Array.isArray(enhanced.results[type])) {
          enhanced.results[type] = enhanced.results[type].map(result => {
            // If the result is missing newAmount but has other data, calculate it
            if (result.success && !result.newAmount && result.adjustedBy !== undefined) {
              const currentAmount = result.currentAmount || 0;
              const adjustedBy = result.adjustedBy || 0;
              return {
                ...result,
                newAmount: currentAmount + adjustedBy,
                currentAmount: currentAmount
              };
            }
            return result;
          });
        }
      });
      
      return enhanced;
    });

    // Methods
    const clearMessages = () => {
      error.value = null;
      success.value = null;
    };

    const showError = (message) => {
      error.value = message;
      setTimeout(() => { error.value = null; }, 5000);
    };

    const showSuccess = (message) => {
      success.value = message;
      setTimeout(() => { success.value = null; }, 3000);
    };

    const handleFileSelect = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      if (file.type !== 'application/pdf') {
        showError('Please select a PDF file');
        return;
      }

      clearMessages();
      uploading.value = true;

      try {
        const formData = new FormData();
        formData.append('invoice', file);

        const response = await fetch('/api/parse', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to parse invoice');
        }

        const data = await response.json();
        invoiceData.value = data;
        currentStep.value = 2;
        showSuccess(`Successfully parsed invoice with ${data.ingredients.length} ingredients`);

      } catch (err) {
        showError(err.message);
      } finally {
        uploading.value = false;
        // Reset file input
        event.target.value = '';
      }
    };

    const testConnection = async () => {
      clearMessages();
      testingConnection.value = true;

      try {
        const response = await fetch('/api/test-connection', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(brewfatherCredentials)
        });

        const data = await response.json();

        if (data.success) {
          credentialsVerified.value = true;
          // Save credentials to localStorage on successful verification
          saveCredentialsToStorage();
          showSuccess('Brewfather connection successful! Credentials saved.');
        } else {
          throw new Error(data.message || 'Connection failed');
        }

      } catch (err) {
        showError(err.message);
      } finally {
        testingConnection.value = false;
      }
    };

    const analyzeMatches = async () => {
      clearMessages();
      analyzing.value = true;

      try {
        const response = await fetch('/api/analyze-matches', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ingredients: invoiceData.value.ingredients,
            ...brewfatherCredentials
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to analyze matches');
        }

        const data = await response.json();
        matchResults.value = data;
        analysisComplete.value = true;
        showSuccess('Ingredient matching analysis complete');

      } catch (err) {
        showError(err.message);
      } finally {
        analyzing.value = false;
      }
    };

    const syncWithBrewfather = async () => {
      clearMessages();
      syncing.value = true;

      try {
        const matchedIngredients = ingredientsWithMatches.value.filter(
          ingredient => ingredient.matchStatus === 'exact' || ingredient.matchStatus === 'partial'
        );
        
        const noMatchIngredients = ingredientsWithMatches.value.filter(
          ingredient => ingredient.matchStatus === 'none'
        );

        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ingredients: matchedIngredients,
            ...brewfatherCredentials
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to sync with Brewfather');
        }

        const data = await response.json();
        
        // Add "no match" items to the sync results for display
        if (noMatchIngredients.length > 0) {
          // Group no-match ingredients by type
          const noMatchByType = {};
          noMatchIngredients.forEach(ingredient => {
            if (!noMatchByType[ingredient.type]) {
              noMatchByType[ingredient.type] = [];
            }
            noMatchByType[ingredient.type].push({
              name: ingredient.name,
              success: false,
              action: 'no_match',
              error: 'Could not match to any Brewfather ingredient name'
            });
          });
          
          // Merge with existing results
          data.results = data.results || {};
          Object.keys(noMatchByType).forEach(type => {
            if (data.results[type]) {
              data.results[type] = data.results[type].concat(noMatchByType[type]);
            } else {
              data.results[type] = noMatchByType[type];
            }
          });
        }
        
        syncResults.value = data;
        showSuccess('Successfully synced with Brewfather!');

      } catch (err) {
        showError(err.message);
      } finally {
        syncing.value = false;
      }
    };

    const generateReports = async () => {
      if (!invoiceData.value?.invoice || !invoiceData.value?.ingredients) {
        showError('No invoice data available to generate reports');
        return;
      }

      clearMessages();
      generatingReports.value = true;

      try {
        const response = await fetch('/api/generate-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            invoiceData: invoiceData.value.invoice,
            ingredients: invoiceData.value.ingredients
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate reports');
        }

        const data = await response.json();
        reports.value = data.reports;
        showReportsModal.value = true;

      } catch (err) {
        showError(err.message);
      } finally {
        generatingReports.value = false;
      }
    };

    const downloadReport = (report, type) => {
      const blob = new Blob([report.content], {
        type: type === 'json' ? 'application/json' : 'text/csv'
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    };

    const resetApp = () => {
      currentStep.value = 1;
      invoiceData.value = null;
      matchResults.value = null;
      syncResults.value = null;
      credentialsVerified.value = false;
      analysisComplete.value = false;
      clearMessages();
    };

    const clearStoredCredentials = () => {
      brewfatherCredentials.userId = '';
      brewfatherCredentials.apiKey = '';
      credentialsVerified.value = false;
      clearCredentialsFromStorage();
      showSuccess('Credentials cleared from storage');
    };

    return {
      // State
      currentStep,
      error,
      success,
      uploading,
      invoiceData,
      generatingReports,
      testingConnection,
      credentialsVerified,
      analyzing,
      analysisComplete,
      matchResults,
      syncing,
      syncResults,
      showReportsModal,
      reports,
      brewfatherCredentials,

      // Computed
      ingredientsWithMatches,
      matchSummary,
      hasStoredCredentials,
      getSyncSummary,
      enhancedSyncResults,

      // Methods
      handleFileSelect,
      testConnection,
      analyzeMatches,
      syncWithBrewfather,
      generateReports,
      downloadReport,
      resetApp,
      clearStoredCredentials,
      getTypeIcon
    };
  }
}).mount('#app');
