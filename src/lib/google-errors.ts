/**
 * Transforme les erreurs Google (API désactivée, token révoqué, quota…) en
 * messages compréhensibles pour l'utilisateur.
 */
export function describeGoogleError(error: unknown): string {
  const err = error as {
    code?: number | string;
    message?: string;
    response?: {
      data?: {
        error?: string | { message?: string; status?: string };
        error_description?: string;
      };
    };
  };

  const payload = err?.response?.data;
  const apiMessage =
    typeof payload?.error === "string"
      ? payload.error
      : payload?.error?.message || payload?.error_description;

  const everything = `${err?.message ?? ""} ${apiMessage ?? ""}`;

  if (/invalid_grant|invalid_request|token has been expired|token has been revoked/i.test(everything)) {
    return "Votre autorisation Google a expiré. Déconnectez-vous puis reconnectez-vous.";
  }

  if (apiMessage === "access_denied" || err?.code === 401) {
    return "Accès refusé par Google. Déconnectez-vous puis reconnectez-vous.";
  }

  if (
    err?.code === 403 ||
    /PERMISSION_DENIED|forbidden|insufficient permission/i.test(everything)
  ) {
    return "Google a refusé l'accès. Vérifiez que les API Google Sheets et Google Drive sont bien activées dans votre projet Cloud, puis reconnectez-vous.";
  }

  if (err?.code === 429) {
    return "Trop de requêtes envoyées à Google. Réessayez dans quelques minutes.";
  }

  if (err?.code === 404) {
    return "La feuille de calcul est introuvable (elle a peut-être été supprimée). Reconnectez-vous pour en recréer une.";
  }

  if (/quota/i.test(everything)) {
    return "Le quota Google est dépassé. Réessayez plus tard.";
  }

  return (
    apiMessage ||
    err?.message ||
    "Une erreur inattendue est survenue avec Google. Réessayez."
  );
}
