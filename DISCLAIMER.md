# Disclaimer / Avertissement

> ⚠️ Read this before integrating DaysUnit into any production system.
> ⚠️ À lire avant toute intégration de DaysUnit dans un système en production.

---

## English

### 1. No warranty of accuracy

DaysUnit is a community calendar reference compiled from public sources. The data **may contain errors, omissions, or outdated information**, including but not limited to:

- Missing or incorrect public holidays
- Wrong `isWorkingDay`, `isFirstWorkingDayOfMonth`, or `isLastWorkingDayOfMonth` flags
- Outdated holiday observance dates following last-minute government decrees
- Variable-date Islamic holidays whose observed date can shift after publication

Every record carries a `confidence` field (`confirmed | tentative | ai-generated`). **Records with `confidence: "ai-generated"` or `confidence: "tentative"` are not authoritative and must not be relied on without independent verification.**

### 2. Not the legal source of record

**Do not use DaysUnit as the sole authority for legal, financial, regulatory, or operational decisions.** For authoritative dates, consult the *Journal Officiel* of the relevant country, the official government calendar, or a competent legal advisor.

This applies particularly to, but is not limited to:

- Payroll processing and salary disbursement timing
- SYSCOHADA accounting period closures
- Tax filing and remittance deadlines
- Court filing and statute-of-limitations calculations
- Bank settlement, clearing, and value-date calculations
- Employment law working-time computations
- Government tender and procurement deadlines

### 3. No government affiliation

DaysUnit is **not affiliated with, endorsed by, sponsored by, or representative of** any government, ministry, agency, or institution of any UEMOA member state, ECOWAS member state, or any other state. The data is independently compiled from publicly available sources and is provided as a convenience reference only.

### 4. No liability

To the maximum extent permitted by applicable law, the author and any contributors disclaim all liability for damages — direct, indirect, incidental, consequential, special, or punitive — arising from the use of, or inability to use, DaysUnit data or software, including damages from errors, omissions, system unavailability, or data integrity failures.

By integrating DaysUnit into your application, fetching data from `days.claviscore.com`, or installing the `@claviscore/days` package, **you accept these terms** and assume sole responsibility for verifying data accuracy against authoritative sources before using it for any purpose with legal or financial consequences.

### 5. Reporting errors

If you find an error, please open a [data error issue](https://github.com/Dahkenangnon/days/issues/new?template=data-error.yml) with the affected date, your country, and a link to an authoritative source. Errors that could affect payroll or financial systems should be reported privately per [SECURITY.md](SECURITY.md).

---

## Français

### 1. Aucune garantie d'exactitude

DaysUnit est une référence calendaire communautaire compilée à partir de sources publiques. Les données **peuvent contenir des erreurs, omissions ou informations obsolètes**, y compris mais sans s'y limiter :

- Jours fériés manquants ou incorrects
- Indicateurs `isWorkingDay`, `isFirstWorkingDayOfMonth` ou `isLastWorkingDayOfMonth` erronés
- Dates d'observance de jours fériés obsolètes suite à des décrets gouvernementaux de dernière minute
- Fêtes islamiques à date variable dont la date observée peut changer après publication

Chaque enregistrement porte un champ `confidence` (`confirmed | tentative | ai-generated`). **Les enregistrements avec `confidence: "ai-generated"` ou `confidence: "tentative"` ne font pas foi et ne doivent pas être utilisés sans vérification indépendante.**

### 2. Pas une source légale de référence

**N'utilisez pas DaysUnit comme seule autorité pour des décisions juridiques, financières, réglementaires ou opérationnelles.** Pour les dates faisant foi, consultez le *Journal Officiel* du pays concerné, le calendrier officiel du gouvernement, ou un conseiller juridique compétent.

Cela s'applique notamment, sans s'y limiter, à :

- Traitement de la paie et calendrier des virements salariaux
- Clôtures comptables SYSCOHADA
- Échéances de déclaration et de versement fiscal
- Dépôt judiciaire et calcul des délais de prescription
- Règlement bancaire, compensation et dates de valeur
- Calculs de durée de travail en droit du travail
- Échéances de marchés publics et appels d'offres

### 3. Aucune affiliation gouvernementale

DaysUnit n'est **ni affilié, ni cautionné, ni parrainé par, ni représentatif** d'aucun gouvernement, ministère, agence ou institution d'un État membre de l'UEMOA, de la CEDEAO, ou de tout autre État. Les données sont compilées indépendamment à partir de sources publiquement accessibles et sont fournies à titre de référence de commodité uniquement.

### 4. Absence de responsabilité

Dans la mesure maximale permise par le droit applicable, l'auteur et les contributeurs déclinent toute responsabilité pour tout dommage — direct, indirect, accessoire, consécutif, spécial ou punitif — résultant de l'utilisation, ou de l'impossibilité d'utiliser, les données ou le logiciel DaysUnit, y compris les dommages résultant d'erreurs, d'omissions, d'indisponibilité de service ou de défaillances d'intégrité des données.

En intégrant DaysUnit dans votre application, en récupérant des données depuis `days.claviscore.com`, ou en installant le paquet `@claviscore/days`, **vous acceptez ces conditions** et assumez la seule responsabilité de vérifier l'exactitude des données auprès de sources faisant foi avant tout usage à conséquence juridique ou financière.

### 5. Signalement d'erreurs

Si vous trouvez une erreur, veuillez ouvrir un [ticket d'erreur de donnée](https://github.com/Dahkenangnon/days/issues/new?template=data-error.yml) en indiquant la date concernée, le pays, et un lien vers une source faisant foi. Les erreurs pouvant affecter la paie ou les systèmes financiers doivent être signalées en privé conformément à [SECURITY.md](SECURITY.md).

---

*Last updated / Dernière mise à jour : 2026-05-07*
