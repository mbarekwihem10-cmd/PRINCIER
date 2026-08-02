/**
 * Configuration ESLint pour l'API NestJS.
 * Ajoute l'application automatique des frontières de modules définies
 * dans le Handbook, section 1.2 : un module ne doit jamais importer
 * directement l'infrastructure d'un autre module.
 */
module.exports = {
  extends: ["./base.js"],
  rules: {
    // Handbook 1.2 : aucun accès direct à l'infrastructure d'un autre module.
    // Toute exception (ex: shared-types) doit être ajoutée explicitement ici,
    // jamais désactivée localement dans un fichier.
    "import/no-restricted-paths": [
      "error",
      {
        zones: [
          {
            target: "./src/modules/*/domain",
            from: [
              "./src/modules/*/infrastructure",
              "./src/modules/*/application",
            ],
            message:
              "Le Domaine ne peut dépendre ni de l'Application ni de l'Infrastructure (Handbook 1.5).",
          },
          {
            target: "./src/modules/*/application",
            from: "./src/modules/*/infrastructure",
            message:
              "L'Application ne peut pas dépendre de l'Infrastructure (Handbook 1.5).",
          },
        ],
      },
    ],
  },
};
