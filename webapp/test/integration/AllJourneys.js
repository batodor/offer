/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"Offer/Offer/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"Offer/Offer/test/integration/pages/Worklist",
	"Offer/Offer/test/integration/pages/Object",
	"Offer/Offer/test/integration/pages/NotFound",
	"Offer/Offer/test/integration/pages/Browser",
	"Offer/Offer/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "Offer.Offer.view."
	});

	sap.ui.require([
		"Offer/Offer/test/integration/WorklistJourney",
		"Offer/Offer/test/integration/ObjectJourney",
		"Offer/Offer/test/integration/NavigationJourney",
		"Offer/Offer/test/integration/NotFoundJourney",
		"Offer/Offer/test/integration/FLPIntegrationJourney"
	], function () {
		QUnit.start();
	});
});