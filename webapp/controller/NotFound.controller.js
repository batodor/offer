sap.ui.define([
		"Offer/Offer/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("Offer.Offer.controller.NotFound", {

			/**
			 * Navigates to the worklist when the link is pressed
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("worklist");
			}

		});

	}
);