/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"com/sedef/hcm/ux/mypaystubs/controller/BaseController"
], function(BaseController) {
	"use strict";

	return BaseController.extend("com.sedef.hcm.ux.mypaystubs.controller.NotFound", {

		/**
		 * Navigates to the paystubs when the link is pressed
		 * @public
		 */
		onLinkPressed: function() {
			this.getRouter().navTo("paystubsList");
		}
	});
});