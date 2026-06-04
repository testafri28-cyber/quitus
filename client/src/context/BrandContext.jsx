import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { settingsApi } from "../api/endpoints.js";
import { BRAND_DEFAULTS, applyBrand } from "../lib/brand.js";

const BrandContext = createContext(null);

// Charge les couleurs de marque au démarrage (endpoint public → fonctionne aussi sur /login)
// et les applique globalement. Expose l'aperçu live + la sauvegarde (admin).
export function BrandProvider({ children }) {
  const [brand, setBrand] = useState(BRAND_DEFAULTS);

  useEffect(() => {
    settingsApi.getBranding()
      .then(({ branding }) => { setBrand(branding); applyBrand(branding); })
      .catch(() => applyBrand(BRAND_DEFAULTS));
  }, []);

  // Aperçu immédiat (sans enregistrer) — re-thématise toute l'app.
  const previewBrand = useCallback((b) => { setBrand(b); applyBrand(b); }, []);

  const saveBrand = useCallback(async (b) => {
    const { branding } = await settingsApi.updateBranding(b);
    setBrand(branding); applyBrand(branding);
    return branding;
  }, []);

  const resetBrand = useCallback(() => saveBrand(BRAND_DEFAULTS), [saveBrand]);

  return (
    <BrandContext.Provider value={{ brand, previewBrand, saveBrand, resetBrand }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext) || { brand: BRAND_DEFAULTS, previewBrand: () => {}, saveBrand: async () => {}, resetBrand: async () => {} };
}
