module.exports = {
  extends: ["./base.js", "next/core-web-vitals"],
  rules: {
    // Handbook — Phase 1 : "API First", aucune logique métier côté frontend.
    // Cette règle est un garde-fou : elle empêche d'importer directement
    // un client de base de données ou un SDK serveur dans le code React.
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@prisma/client",
            message:
              "Le frontend web ne doit jamais accéder directement à la base de données (Handbook — API First).",
          },
        ],
      },
    ],
  },
};
