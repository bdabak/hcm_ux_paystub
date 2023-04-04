sap.ui.define(["sap/ui/core/Control"], function (Control) {
  "use strict";
  var E = Control.extend("com.sedef.hcm.ux.mypaystubs.controls.Blob", {
    metadata: {
      properties: {},
      aggregations: {},
      events: {},
    },

    init: function () {
      //initialisation code, in this case, ensure css is imported
      var sLibraryPath = jQuery.sap.getModulePath(
        "com.sedef.hcm.ux.mypaystubs"
      ); //get the server location of the ui library
      jQuery.sap.includeStyleSheet(sLibraryPath + "/controls/Blob.css");
    },

    renderer: function (oRM, oControl) {
      var sLibraryPath = jQuery.sap.getModulePath(
        "com.sedef.hcm.ux.mypaystubs"
      ); //get the server location of the ui library

      //Main content begin
      oRM.openStart("div");
      oRM.writeControlData(oControl);
      oRM.class("smod-blob-container");

      oRM.openEnd();

      //Images
      oRM.openStart("img");
      oRM.class("smod-blob-image");
      oRM.attr("src", sLibraryPath + "/assets/blob-01.svg");
      oRM.openEnd();
      oRM.close("img");

      oRM.openStart("img");
      oRM.class("smod-blob-image");
      oRM.attr("src", sLibraryPath + "/assets/blob-02.svg");
      oRM.openEnd();
      oRM.close("img");

      oRM.openStart("img");
      oRM.class("smod-blob-image");
      oRM.attr("src", sLibraryPath + "/assets/blob-03.svg");
      oRM.openEnd();
      oRM.close("img");
      //Images end

      oRM.close("div");
    },
  });

  return E;
});
