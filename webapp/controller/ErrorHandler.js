/*
 * Copyright (C) 2009-2018 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/base/Object",
	"sap/m/MessageBox"
], function(UI5Object, MessageBox) {
	"use strict";

	function fnExtractErrorContentFromResponse(sResponse) {
		var errorJSON,
			oError = {
				sMessage: sResponse,
				sDetails: null,
				aInnerErrors: []
			};

		try {
			// try to parse error as JSON-object first
			errorJSON = JSON.parse(sResponse);

			if (errorJSON && errorJSON.error) {
				if (errorJSON.error.message && errorJSON.error.message.value) {
					oError.sMessage = errorJSON.error.message.value;
				}
				if (errorJSON.error.code) {
					oError.sDetails = errorJSON.error.code;
				}
				if (errorJSON.error.innererror && errorJSON.error.innererror.errordetails) {
					oError.aInnerErrors = errorJSON.error.innererror.errordetails;
				}
			}

		} catch (e) {
			// xml is parsed using jQuery
			try {
				var xmlDoc = jQuery.parseXML(sResponse);
			} catch (f) {
				jQuery.sap.log.error(f);
			}

			if (xmlDoc) {
				oError.sMessage = xmlDoc.getElementsByTagName("message")[0].childNodes[0].nodeValue || xmlDoc.documentElement;
				oError.sDetails = xmlDoc.getElementsByTagName("code")[0].childNodes[0].nodeValue;
				oError.aInnerErrors = xmlDoc.getElementsByTagName("errordetail");
			} else {
				// Just in case that the Error from request could not be parsed
				oError.sMessage = sResponse;
			}
		}
		return oError;
	}

	function fnParseError(oEvent) {
		var oParameters = null,
			oResponse = null;

		// "getParameters": for the case of catching oDataModel "requestFailed" event
		oParameters = oEvent.getParameters ? oEvent.getParameters() : null;
		// "oParameters.response": V2 interface, response object is under the getParameters()
		// "oParameters": V1 interface, response is directly in the getParameters()
		// "oEvent" for the case of catching request "onError" event
		oResponse = oParameters ? (oParameters.response || oParameters) : oEvent;
		var responseContent = oResponse.responseText || oResponse.body || (oResponse.response && oResponse.response.body) || ""; //"onError" Event: V1 uses response and response.body
		return fnExtractErrorContentFromResponse(responseContent);
	}

	return UI5Object.extend("hcm.fab.employeelookup.controller.ErrorHandler", {

		/**
		 * Handles application errors by automatically attaching to the model events and displaying errors when needed.
		 * @class
		 * @param {sap.ui.core.UIComponent} oComponent reference to the app's component
		 * @public
		 * @alias hcm.fab.employeelookup.controller.ErrorHandler
		 */
		constructor: function(oComponent) {
			this._oResourceBundle = oComponent.getModel("i18n").getResourceBundle();
			this._oComponent = oComponent;
			this._bMessageOpen = false;
			this._oModel = oComponent.getModel();
			this._sErrorText = this._oResourceBundle.getText("errorTitle");

			this._oModel.attachMetadataFailed(function(oEvent) {
				var oParams = oEvent.getParameters();
				this._showMetadataError(oParams.response);
			}, this);

			this._oModel.attachRequestFailed(this.onRequestFailed, this);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event Handler for Request Fail event
		 * The user can try to refresh the metadata.
		 * @param {object} oEvent an event containing the response data
		 * @private
		 */
		onRequestFailed: function(oEvent) {
			var oError = fnParseError(oEvent);
			// deal with main error message from response
			this._showServiceError(oError.sMessage, oError.sDetails);
		},

		/**
		 * Shows a {@link sap.m.MessageBox}.
		 * @param {object} oEvent an event containing the response data, {function} a function that is executed on closing the MessageBox
		 * @public
		 */
		showErrorMsg: function(oEvent, fnOnClose) {
			var oErrorDetails = fnParseError(oEvent);
			MessageBox.show(oErrorDetails.sMessage, {
				icon: MessageBox.Icon.ERROR,
				title: this._oResourceBundle.getText("errorTitle"),
				details: oErrorDetails.sDetails,
				actions: MessageBox.Action.CLOSE,
				onClose: fnOnClose,
				styleClass: this._oComponent.getContentDensityClass()
			});
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when the metadata call has failed.
		 * The user can try to refresh the metadata.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showMetadataError: function(sDetails) {
			MessageBox.error(
				this._sErrorText, {
					id: "metadataErrorMessageBox",
					details: sDetails,
					styleClass: this._oComponent.getContentDensityClass(),
					actions: [MessageBox.Action.RETRY, MessageBox.Action.CLOSE],
					onClose: function(sAction) {
						if (sAction === MessageBox.Action.RETRY) {
							this._oModel.refreshMetadata();
						}
					}.bind(this)
				}
			);
		},

		/**
		 * Shows a {@link sap.m.MessageBox} when a service call has failed.
		 * Only the first error message will be display.
		 * @param {string} sDetails a technical error to be displayed on request
		 * @private
		 */
		_showServiceError: function(sErrorText, sErrorDetails, sTitleText) {
			if (this._bMessageOpen) {
				return;
			}
			this._bMessageOpen = true;
			MessageBox.error(sErrorText, {
				id: "serviceErrorMessageBox",
				title: sTitleText ? sTitleText : this._sErrorText,
				details: sErrorDetails,
				styleClass: this._oComponent.getContentDensityClass(),
				actions: [MessageBox.Action.CLOSE],
				onClose: function() {
					this._bMessageOpen = false;
				}.bind(this)
			});
		}
	});
});