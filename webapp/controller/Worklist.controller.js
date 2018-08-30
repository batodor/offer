/*global location history */
sap.ui.define([
		"Offer/Offer/controller/BaseController",
		"sap/ui/model/json/JSONModel",
		"sap/ui/core/routing/History",
		"Offer/Offer/model/formatter",
		"sap/ui/model/Filter",
		"sap/ui/model/FilterOperator",
		'sap/m/MessageBox',
		'sap/m/MessageToast'
	], function (BaseController, JSONModel, History, formatter, Filter, FilterOperator, MessageBox, MessageToast) {
		"use strict";

		return BaseController.extend("Offer.Offer.controller.Worklist", {

			formatter: formatter,
			
			onInit : function () {
				// Model used to manipulate control states
				var oViewModel = new JSONModel({
					worklistTableTitle : this.getResourceBundle().getText("worklistTableTitle"),
					saveAsTileTitle: this.getResourceBundle().getText("saveAsTileTitle", this.getResourceBundle().getText("worklistViewTitle")),
					shareOnJamTitle: this.getResourceBundle().getText("worklistTitle"),
					shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
					shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
					tableNoDataText : this.getResourceBundle().getText("tableNoDataText"),
					tableBusyDelay : 0
				});
				this.setModel(oViewModel, "worklistView");
				
				// Declare global filter
			    this.search = {}; // for searchFields
				this.typeArr = ["value", "dateValue", "selectedKey", "selected", "state", "tokens"];
				
				// Add fragments
				var fragmentsArr = [ "counterpartyPopupDialog", "portPopupDialog", "currencyPopupDialog", "volumeUomPopupDialog", "volumes", "periodsPrices", "approveDialog" ];
				this.addFragments(fragmentsArr);
				
				this.getRouter().getRoute("worklist").attachPatternMatched(this._onOfferMatched, this);
			},
			
			// After offer loaded, sets the mode Create/Edit
			_onOfferMatched: function(oEvent) {
				this.TCNumber = oEvent.getParameter("arguments").TCNumber;
				this.Type = oEvent.getParameter("arguments").Type;
				this.getModel().metadataLoaded().then( function() {
					if(this.Type){
						this.byId("offerTitle").setText(this.getResourceBundle().getText("editOffer2"));
						this.byId("navCon").to(this.byId("p1"));
					}
					if(this.TCNumber){
						this.getView().bindElement({ 
							path: "/offerHeaderSet('" + this.TCNumber + "')" 
						});
						this.byId("offerTitle").setText(this.getResourceBundle().getText("editOffer", [this.TCNumber]));
						this.byId("tableApprove").setEnabled(true);
						this.setInput(["uploadDownload", "uploadDelete", "uploadVbox"], true, "Visible");
					}else{
						this.byId("creationDate").setDateValue(new Date());
						this.byId("trader").setSelectedKey(sap.ushell.Container.getService("UserInfo").getUser().getId());
						this.byId("createdBy").setValue(sap.ushell.Container.getService("UserInfo").getUser().getId());
						this.setInput(["uploadDownload", "uploadDelete"], false, "Visible");
					}
				}.bind(this));
			},
			
			// This function triggered after bind 
			// Added in Select(Product Type)
			dataReceived: function(){
				if(this.TCNumber){
					var that = this;
					setTimeout(function(){
						that.filterSelect();
					});
				}
			},
			
			// Main save offer function, also runned for creating and saving existing offer
			saveOffer: function(oEvent){
				var button = oEvent.getSource();
				var objectsArr = button.data("blocks").split(',');
				var offerData = this.getData(objectsArr);
				var volumeDataAndCheck = this.getVolumeData();
				if(volumeDataAndCheck.check){
					var msg = this.getResourceBundle().getText("plsEnter") + " " + volumeDataAndCheck.check.slice(0,-4);
					this.alert(msg);
				}else{
					this.setInput(["saveOffer1","saveOffer2"], false, "Enabled");
					var model = button.getModel();
					var allData = this.mergeObjects(offerData,volumeDataAndCheck.data);
					var uploader = this.byId("upload");
					var settings = {};
					var msg = ''; 
					var that = this;
					if(allData.TCNumber === "$$00000001"){
						msg = that.getResourceBundle().getText("offerCreated");
					}else{
						msg = this.getResourceBundle().getText("offerSaved");
					}
					console.log(allData);
					settings.success = function(response){
						that.alert(msg + " " + response.TCNumber, {
							actions: [sap.m.MessageBox.Action.CLOSE],
							onClose: function(sAction){
								if(allData.TCNumber === "$$00000001"){
									that.getRouter().navTo("worklist", {
										TCNumber: response.TCNumber
									});
								}
							} 
						});
						if(uploader.getValue()){
							var uploadUrl = model.sServiceUrl + "/offerHeaderSet('" + response.TCNumber + "')/ToAttachment";
							uploader.setUploadUrl(uploadUrl);
							uploader.upload();
						}
						that.setInput(["saveOffer1","saveOffer2"], true, "Enabled");
					};
					settings.error = function(){
						that.setInput(["saveOffer1","saveOffer2"], true, "Enabled");
					};
					model.create("/offerHeaderSet", allData, settings);
				}
			},
			
			// Actually opens the approve dialog
			tableApprove: function(oEvent){
				var id = oEvent.getSource().data("id");
				this[id + "Dialog"].open();
			},
			
			// Event on selection of table items
			onTableSelect: function(oEvent) {
				var table = oEvent.getSource();
				var selectedCount = table.getSelectedItems().length;
				var id = table.data("id");
				var select = this.byId(id + "Select") || sap.ui.getCore().byId(id + "Select");
				if (selectedCount > 0) {
					select.setEnabled(true);
				}
			},
			
			// Dialog functions
			dialogCancel: function(oEvent) {
				var id = oEvent.getSource().data("id");
				this[id + "Dialog"].close();
			},
			dialogSelect: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var key = button.data("key");
				var dynamicId = button.data("dynamicId");
				var valueHelp = this.byId(dynamicId) || sap.ui.getCore().byId(dynamicId);
				var items = sap.ui.getCore().byId(id).getSelectedItems();
				if(id === "counterpartyPopup"){
					var tokens = this.byId("counterparty").getTokens();
					var countries = "";
				}
				for(var i = 0; i < items.length; i++){
					var item = items[i];
					var path = item.getBindingContextPath();
					var data = item.getModel().getData(path);
					if(id === "counterpartyPopup"){
						var token = new sap.m.Token({
							key: data.Code,
							text: data.Name
						});
						tokens.push(token);
						if(data.Country){
							countries = countries + data.Country + ", ";
						}
						this.byId("counterpartyOne").setValue(data.Code);
					}else{
						var value = data.hasOwnProperty("Name") ? data.Name : data[key];
						valueHelp.data("data", data[key]);
						valueHelp.setValue(value);
					}
				}
				if(id === "counterpartyPopup"){
					valueHelp.setTokens(tokens);
					var countriesText = this.byId("countriesSanction");
					if(countries){
						countriesText.setText(countries.slice(0,-2)).addStyleClass("red");
					}else{
						countriesText.removeStyleClass("red");
					}
				}
				this[id + "Dialog"].close();
			},
			dialogApprove: function(oEvent){
				var uploadItems = sap.ui.getCore().byId("approveUpload").getSelectedItems();
				var attachList = '';
				for(var i = 0; i < uploadItems.length; i++){
					attachList = attachList + this.getModel().getData(uploadItems[i].getBindingContextPath()).FileGUID + ";";
				}
				attachList = attachList.slice(0,-1);
				var oFuncParams = { 
					TCNumber: this.TCNumber,
					Comment: sap.ui.getCore().byId("approveComment").getValue(),
					ValidityDate: sap.ui.getCore().byId("approveValidityDate").getDateValue(),
					AttachList: attachList,
					GlobalTrader: sap.ui.getCore().byId("approveTrader").getSelectedKey()
				};
				console.log(oFuncParams);
				this.getModel().callFunction("/SentOfferToApproval", {
					method: "POST",
					urlParameters: oFuncParams,
					success: this.onApproveSuccess.bind(this, "SentOfferToApproval")
				});
			},
			onApproveSuccess: function(link, oData) {
				var oResult = oData[link];
				if (oResult.ActionSuccessful) {
					MessageToast.show(oResult.Message);
				} else {
					MessageBox.error(oResult.Message);
				}
			},
			
			// Get Risks on select of Counterparties
			getRisks: function(valueHelp){
				var tokens = valueHelp.getTokens();
				var risks = this.byId("risks");
				risks.removeAllItems();
				var filters = [];
				for(var i = 0; i < tokens.length; i++){
					filters.push(new Filter({path: "Code", operator: FilterOperator.EQ, value1: tokens[i].getKey() }));
				}
				if(filters.length > 0){
					var partnersFilter = new Filter({ filters: filters, and: false });
					var tcnumberFilter = new Filter({path: "TCNumber", operator: FilterOperator.EQ, value1: this.byId("TCNumber").getValue() });
					var allFilters = new Filter({ filters: [ partnersFilter, tcnumberFilter ], and: true });
					risks.bindItems({
						path: "/offerCounterpartySet", 
						filters: allFilters, 
						template: risks['mBindingInfos'].items.template.clone()
					});
				}
			},
			
			// On multi input tokens update
			onMultiUpdate: function(oEvent){
				var input = oEvent.getSource();
				if(this.multi){
					this.getRisks(input);
				}
				this.checkLimits(input);
				this.multi = true;
			},
			
			// Next page function
			nextPage: function(oEvent){
				var button = oEvent.getSource();
				var navCon = this.byId("navCon");
				var next = button.data("next");
				if(button.data("check")){
					var page = this.byId(button.data("id"));
					var bCheckAlert = this.checkKeys(page);
					if(bCheckAlert){
						var msg = this.getModel('i18n').getResourceBundle().getText("plsEnter") + " " + bCheckAlert.slice(0, -2);
						this.alert(msg);
						return true;
					}
				}
				if(next){
					if(button.data("edit")){
						this.getRouter().navTo("worklist", {
							TCNumber: this.byId("offerId").getValue()       
						});
					}
					navCon.to(this.byId(next));
				}else{
					navCon.back();
				}
			},
			
			onListSelect: function(oEvent){
				var list = oEvent.getSource();
				var toolbar = list.getHeaderToolbar().getContent();
				if(list.getSelectedItems().length > 0){
					this.setInput([toolbar[3], toolbar[4]], true, "Enabled");
				}else{
					this.setInput([toolbar[3], toolbar[4]], false, "Enabled");
				}
			},
			
			// Panel functions
			add: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var list = button.getParent().getParent();
				var fragmentClone = this[id].clone();
				this.getView().addDependent(fragmentClone);
				if(id === "volumes"){
					var title = fragmentClone.getHeaderToolbar().getContent()[0];
					var titleValue = fragmentClone.getHeaderToolbar().getContent()[2];
					var length = list.getItems().length + 1;
					if(length < 10){
						title.setText('0' + length + " / " + this.getResourceBundle().getText("fixed"));
						titleValue.setValue('0' + length);
					}else{
						title.setText(length + " / " + this.getResourceBundle().getText("fixed"));
						titleValue.setValue(length);
					}
				}
				var newItem = new sap.m.CustomListItem();
				newItem.addContent(fragmentClone);
				list.addItem(newItem);
			},
			copy: function(oEvent){
				var button = oEvent.getSource();
				var list = button.getParent().getParent();
				var selectedItem = list.getSelectedItem();
				if(selectedItem){
					var id = button.data("id");
					var clone = selectedItem.clone();
					this.getView().addDependent(clone);
					if(id === "volumes"){
						var title = clone.getContent()[0].getHeaderToolbar().getContent()[0];
						var titleValue = clone.getContent()[0].getHeaderToolbar().getContent()[2];
						var length = list.getItems().length + 1;
						if(length < 10){
							title.setText('0' + length + " / " + this.getResourceBundle().getText("fixed"));
							titleValue.setValue('0' + length);
						}else{
							title.setText(length + " / " + this.getResourceBundle().getText("fixed"));
							titleValue.setValue(length);
						}
					}
					if(id === "periodsPrices"){
						var TCPosition = clone.getContent()[0].getContent()[0].getItems()[0];
						TCPosition.setValue("");
					}
					list.addItem(clone);
				}
				this.checkLimits();
			},
			delete: function(oEvent){
				var button = oEvent.getSource();
				var list = button.getParent().getParent();
				var selectedItems = list.getSelectedItems();
				if(selectedItems.length > 0){
					var that = this;
					MessageBox.confirm(that.getResourceBundle().getText("askDelete"), {
						actions: [that.getResourceBundle().getText("delete"), sap.m.MessageBox.Action.CLOSE],
						onClose: function(sAction) {
							if (sAction === that.getResourceBundle().getText("delete")) {
								for(var i=0; i<selectedItems.length; i++){
									list.removeItem(selectedItems[i]);
								}
							} else {
								MessageToast.show("Delete canceled!");
							}
						}
					});
				}
			},
			
			// Enable/Disables inputs depending flag arg
			// idArr can be array of strings as well as objects
			setInput: function(idArr, flag, func){
				var evalStr = 'input.set' + func + '(flag)';
				for(var i = 0; i < idArr.length; i++){
					var input = null;
					if(typeof idArr[i] === "string"){
						input = this.byId(idArr[i]) || sap.ui.getCore().byId(idArr[i]);
					}else if(typeof idArr[i] === "object"){
						input = idArr[i];
					}
					if(input){
						eval(evalStr);
					}
				}
			},
		
			// Checks the key inputs for empty values for dialog Add/Edit
			checkKeys: function(object){
				var check = "";
				var inputs = this.getInputs(object);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input["sId"].indexOf('hbox') > -1){
						var vboxes = input.getItems();
						for(var j = 0; j < vboxes.length; j++){
							check = check + this.checkKeysInner(vboxes[j].getItems()[1]);
						}
					}else{
						check = check +  this.checkKeysInner(input);
					}
					
				}
				return check;
			},
			// Created to check hboxes too
			checkKeysInner: function(input){
				var check = "";
				if(input.data("key")){
					if((input["mProperties"].hasOwnProperty("value") && !input.getValue()) || 
					(input["mProperties"].hasOwnProperty("selectedKey") && !input.getSelectedKey()) ||
					(input.hasOwnProperty("_tokenizer") && input.getTokens().length === 0) ||
					(input.hasOwnProperty("_oMaxDate") && !input.getDateValue())){
						check = check + " " + this.getModel('i18n').getResourceBundle().getText(input.data("key")) + ", ";
					}
				}
				return check;
			},
		
			// Set odata from any dialog, argument object = any object / return object inputs Data
			getData: function(object){
				var oData = {};
				var inputs = this.getInputs(object);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input["sId"].indexOf('hbox') > -1){
						var vboxes = input.getItems();
						for(var j = 0; j < vboxes.length; j++){
							oData = this.mergeObjects(oData, this.getDataInner(vboxes[j].getItems()[1]));
						}
					}else{
						oData = this.mergeObjects(oData, this.getDataInner(input));
					}
				}
				return oData;
			},
			getDataInner: function(input){
				var oData = {};
				for(var j = 0; j < this.typeArr.length; j++){
					var type = this.typeArr[j];
					if(input.getBindingInfo(type) && !input.data("omit")){
						var value;
						if(type === "tokens"){
							var tokens = input.getTokens();
							value = [];
							for(var l = 0; l < tokens.length; l++){
								var token = {};
								token.Name = tokens[l].getText();
								token.Code = tokens[l].getKey();
								value.push(token);
							}
						}else{
							value = input.getProperty(type);
						}
						if(input.data("data")){
							value = input.data("data");
						}
						
						var name = input.getBindingInfo(type).binding.sPath;
						
						// Set default value(placeholder) if value is not defined
						if(!value && input["mProperties"].hasOwnProperty("placeholder")){
							value = input["mProperties"].placeholder;
						}
						
						if(input.data("string")){
							value = value.toString();
						}
						
						// If inputs name is not defined
						if(input.data("name")){
							name = input.data("name");
						}
						
						// Remove offset for dates
						if(input.hasOwnProperty("_oMaxDate")){
							value = input.getDateValue();
							if(value) {
								value.setMinutes(-value.getTimezoneOffset());
							} else { 
								value = null;
							}
						}
						oData[name] = value;
					}
				}
				return oData;
			},
			
			checkValue: function(oEvent){
				var input = oEvent.getSource();
				var maxValue = input.data("max") ? parseInt(input) : 100;
				var value = parseInt(oEvent.getParameter('newValue'));
				var valueState = isNaN(value) ? "Error" : value > maxValue ? "Error" : "Success";
				input.setValueState(valueState);
			},
			
			onSwitch: function(oEvent){
				var Switch = oEvent.getSource();
				var type = Switch.data("type");
				var state = oEvent.getParameter("state");
				Switch.getParent().getParent().getItems()[1].setVisible(state).getItems()[1].setSelectedKey("").setValue("");
				if(Switch.data("switch")){
					Switch.getParent().getParent().getItems()[2].setVisible(!state).getItems()[1].setSelectedKey("").setValue("");
				}
				if(type && type === "volumes"){
					var title = Switch.getParent().getParent().getParent().getParent().getHeaderToolbar().getContent()[0];
					var newText = state ? title.getText().substring(0,5) + this.getResourceBundle().getText("optional") : 
						title.getText().substring(0,5) + this.getResourceBundle().getText("fixed");
					title.setText(newText);
				}
			},

			handleSuggest: function(oEvent) {
				var sTerm = oEvent.getParameter("suggestValue");
				var filterName = oEvent.getSource().data("select") ? oEvent.getSource().data("select") : "Name";
				var aFilters = [];
				if (sTerm) {
					aFilters.push(new Filter(filterName, sap.ui.model.FilterOperator.StartsWith, sTerm));
				}
				oEvent.getSource().getBinding("suggestionItems").filter(aFilters);
			},
			
			// Gete inputs from array of ids or directly from object
			getInputs: function(object){
				var inputs = [];
				if(Array.isArray(object)){
					for(var i = 0; i < object.length; i++){
						var obj = this.byId(object[i]) || sap.ui.getCore().byId(object[i]);
						var objInputs = obj.getAggregation("content") || obj.getAggregation("items");
						inputs = inputs.concat(objInputs);
					}
				}else{
					inputs = object.getAggregation("content") || object.getAggregation("items");
				}
				return inputs;
			},
			
			getVolumeData: function(){
				var oData = {};
				oData.data = {};
				oData.check = "";
				var list = this.byId("volumesList");
				var volumes = list.getItems();
				oData.data.ToOfferVolume = [];
				for(var i = 0; i < volumes.length; i++){
					var volumeName = this.getData(volumes[i].getContent()[0].getHeaderToolbar());
					var volumeData = this.getData(volumes[i].getContent()[0].getContent()[0]);
					var allVolumeData = this.mergeObjects(volumeName, volumeData);
					
					var volumeCheck = this.checkDataInner(allVolumeData, ["Incoterms", "DeliveryPoint", "FixPrice"]);
					if(volumeCheck){
						oData.check = oData.check + volumeCheck + ", ";
					}
					if(allVolumeData.VolumeType){
						var volumeTypeCheck = this.checkDataInner(allVolumeData, ["VolumeOwner"]);
						if(volumeTypeCheck){
							oData.check = oData.check + volumeTypeCheck + ", ";
						}
					}
					if(allVolumeData.PriceType){
						var volumeIndexFormula = this.checkDataInner(allVolumeData, ["IndexFormula"]);
						if(volumeIndexFormula){
							oData.check = oData.check + this.getResourceBundle().getText("indexFormula") + ", ";
						}
					}else{
						var volumePriceForBase = this.checkDataInner(allVolumeData, ["OfferPriceForBase"]);
						if(volumePriceForBase){
							oData.check = oData.check + this.getResourceBundle().getText("offerPriceForBase") + ", ";
						}
					}
					
					var periods = volumes[i].getContent()[0].getContent()[1].getItems();
					if(periods.length === 0){
						if(oData.check){
							oData.check = oData.check.slice(0,-2);
						}
						oData.check = oData.check + " and Periods";
					}
					allVolumeData.ToOfferPeriod = [];
					for(var j = 0; j < periods.length; j++){
						var period = periods[j].getContent()[0].getContent()[0];
						var periodData = this.getData(period);
						allVolumeData.ToOfferPeriod.push(periodData);
						var checkPeriods = this.checkDataInner(periodData, ["DateFrom", "DateTo"]);
						if(checkPeriods && oData.check){
							oData.check = oData.check.slice(0,-1) + " and ";
						}
						oData.check = oData.check + checkPeriods;
						
						if(checkPeriods){
							oData.check = oData.check + " for Period " + (j + 1) + " ";
						}
					}
					oData.data.ToOfferVolume.push(allVolumeData);
					if(oData.check){
						oData.check = oData.check + " in Volume " + allVolumeData.VolumeNumber + " \n\n ";
					}
				}
				return oData;
			},
			
			onDateChange: function(oEvent){
				var dp = oEvent.getSource();
				var type = dp.data("key");
				var title = dp.getParent().getParent().getParent().getParent().getHeaderToolbar().getContent()[0];
				var date = dp.getDateValue() ? dp.getDateValue().toLocaleDateString() : '';
				var dp2,date2;
				if(type === "dateFrom"){
					dp2 = dp.getParent().getParent().getItems()[1].getItems()[1];
					date2 = dp2.getDateValue() ? dp2.getDateValue().toLocaleDateString() : '';
					title.setText(date + " - " + date2);
				}else{
					dp2 = dp.getParent().getParent().getItems()[0].getItems()[1];
					if(dp.getDateValue() && dp2.getDateValue() && dp.getDateValue() < dp2.getDateValue()){
						var msg = this.getResourceBundle().getText("wrongDates");
						this.alert(msg);
						return true;
					}
					date2 = dp2.getDateValue() ? dp2.getDateValue().toLocaleDateString() : '';
					title.setText(date2 + " - " + date);
				}
				this.checkLimits();
			},
			
			// On select item in Attachments table
			onAttachmentSelect: function(e){
				var listItems = e.getParameters("listItem");
				if (listItems) {
					var id = e.getSource().data("id");
					this.setInput([id + "Delete", id + "Download"], true, "Enabled");
				}
			},
			
			// -------------------- Attachments functions --------------------
			// Triggered each time the new file was selected in fileUploader
			// Changes the fileName (slug)
			onFileChange: function(oEvent){
				var uploader = oEvent.getSource();
				var name = oEvent.getParameter("newValue");
				var uploadModel = uploader.getModel("upload");
				if(uploadModel){
					var data = uploadModel.getData();
					data.fileName = encodeURI(name);
					uploadModel.setData(data);
				}else{
					var model = this.getModel();
					var oData = { token: model.getSecurityToken(), fileName: encodeURI(name) };
					var newModel = new JSONModel(oData);
					uploader.setModel(newModel,"upload");
				}
				if(uploader.getValue()){
					this.byId("uploadButton").setEnabled(true);
				}
			},
			
			// Download function
			tableDownload: function(oEvent){
				var id = oEvent.getSource().data("id");
				var table = this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
				var url = table.getModel().sServiceUrl + table.getSelectedItem().getBindingContextPath() + "/$value";
				window.open(url);
			},
			tableDelete: function(oEvent) {
				var button = oEvent.getSource();
				var id = button.data("id");
				var table = this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
				var url = table.getSelectedItem().getBindingContextPath();
				
				// If upload table change the delete url
				if(button.data("upload")){
					url = url + "/$value";
				}
				
				var model = table.getModel();
				MessageBox.confirm("Are you sure you want to delete?", {
					actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
					onClose: function(sAction) {
						if (sAction === "Delete") {
							model.remove(url,{
								success: function(){
									
								}
							});
						} else {
							MessageToast.show("Delete canceled!");
						}
					}
				});
			},
			onFileUploaded: function(oEvent){
				var uploader = oEvent.getSource();
				uploader.setValue();
				this.getModel().refresh(true);
			},
			upload: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var uploader = this.byId(id);
				if(uploader.getValue()){
					var model = this.getModel();
					var uploadUrl = model.sServiceUrl + "/offerHeaderSet('" + this.TCNumber + "')/ToAttachment";
					uploader.setUploadUrl(uploadUrl);
					uploader.upload();
				}
			},
			
			
			// oData = object with data, keyArr is array of keys to check
			checkDataInner: function(oData, keyArr){
				var check = "";
				for(var key in oData){
					if(keyArr.indexOf(key) > -1 && !oData[key]){
						check = check + key + ",";
					}
				}
				if(check){
					check = check.slice(0,-1);
				}
				return check;
			},
			
			// Filter function for selectors
			filterSelect: function(oEvent){
				var select = oEvent ? oEvent.getSource() : this.byId("productType");
				var newValue = select.getSelectedItem().getKey();
				var filterName = select.data("filterName");
				var filterSelect = this.byId(select.data("filter"));
				var filter = new Filter(filterName, FilterOperator.EQ, newValue);
				//console.log(filterSelect.getItems());
				filterSelect.getBinding("items").filter(filter);
				this.setSelectDefaultValue(newValue, filterSelect);
			},
			setSelectDefaultValue: function(value, select){
				var url = this.getModel().sServiceUrl;
				$.get(url + "/defaultProductByTypeSet('" + value + "')/?$format=json", function( data ) {
					var id = data.d.Product;
					select.setSelectedKey(id);
				});
			},
			
			// Default alert message
			alert: function(msg, settingsArg){
				var settings = settingsArg ? settingsArg : { actions: [sap.m.MessageBox.Action.CLOSE] };
				MessageBox.alert(msg, settings);
			},
			
			// Add xml fragments to this view as dependent
			// objArr = array of string ids of objects declared on init
			addFragments: function(objArr){
				for(var i = 0; i < objArr.length; i++){
					try {
						this[objArr[i]] = sap.ui.xmlfragment("fragment." + objArr[i], this);
						this.getView().addDependent(this[objArr[i]]);
					} catch (err) {
						// Just in case if any of the dialog fragment has syntax error
						console.log("Error in dialog with ID: " + this.objArr[i] + "Dialog " + err);
					}
					
				}
			},
			
			// Object.assign doesnt work in IE so this function is created
			mergeObjects: function(objOne, objTwo){
				var objs = [objOne, objTwo],
			    result =  objs.reduce(function (r, o) {
			        Object.keys(o).forEach(function (k) {
			            r[k] = o[k];
			        });
			        return r;
			    }, {});
			    return result;
			},
			
			// Search function for all tables
			triggerSearch: function(oEvent) {
				var query = oEvent.getParameter("query") || oEvent.getParameter("selected"),
					id = oEvent.getSource().data('id'),
					key = oEvent.getSource().data('key'),
					customOperator = oEvent.getSource().data('operator'),
					oTable = this.byId(id) || sap.ui.getCore().byId(id),
					filters = [];
					
				if(!this.search[id]){ 
					this.search[id] = {};
				}
				if(typeof query !== "undefined"){
					var operator = FilterOperator.EQ;
					if(customOperator){
						operator = FilterOperator[customOperator];
					}
					this.search[id][key] = new Filter({path: key, operator: operator, value1: query });
				}else{
					delete this.search[id][key];
				}
				
				var filterKeys = Object.keys(this.search[id]);
				for(var i in filterKeys){
					filters.push(this.search[id][filterKeys[i]]);
				}
				var newFilter = new Filter({ filters: filters, and: true });
				if(filters.length === 0){
					newFilter = filters;
				}
				oTable.getBinding("items").filter(newFilter);
			},
			
			// On value help opens new dialog with filters
			handleValueHelp: function(oEvent){
				var button = oEvent.getSource();
				var id = button.data("id");
				var dynamicId = button.getId();
				var bindSet = button.data("set") ? "/" + button.data("set") + 'Set' : "/" + id + 'Set';
				var filters = button.data("filters");
				var table = sap.ui.getCore().byId(id);
				table.bindItems({
					path: bindSet,
					template: table['mBindingInfos'].items.template.clone()
				});
				this.search = {}; // nullify search object
				if(filters){
					var filtersArr = filters.split(',');
					for(var i = 0; i < filtersArr.length; i++){
						for(var j = 0; j < this.typeArr.length; j++){
							var input = sap.ui.getCore().byId(id + filtersArr[i] + "Filter");
							var type = this.typeArr[j];
							if(input["mProperties"].hasOwnProperty(type)){
								input.setProperty(type);
							}
						}
					}
				}
				var selectButton = this.byId(id + "Select") || sap.ui.getCore().byId(id + "Select");
				selectButton.data("dynamicId", dynamicId);
				
				this[id + "Dialog"].getButtons()[1].setEnabled(false);
				this[id + "Dialog"].open();
			},
			
			openMail: function(oEvent){
				//var counterParty = oEvent.getSource().data("key");
				window.open("mailto:");
			},
			
			count: function(oEvent){
				var input = oEvent.getSource();
				var size = input.data("size");
				var vboxArr = size ? input.getParent().getParent().getParent().getItems() : input.getParent().getItems();
				var shipNumber = vboxArr[3].getValue();
				var shipMin = vboxArr[4].getItems()[0].getItems()[1].getValue();
				var shipMax = vboxArr[4].getItems()[1].getItems()[1].getValue();
				var tonMin = vboxArr[6].getItems()[0].getItems()[1];
				var tonMax = vboxArr[6].getItems()[1].getItems()[1];
				tonMin.setValue(shipNumber*shipMin);
				tonMax.setValue(shipNumber*shipMax);
				this.checkLimits();
			},
			
			collectLimitsData: function(){
				var oData = {};
				var offerData = this.getData(["pageOfferDetails","parameters"]);
				var volumeData = this.getVolumeData();
				oData.Partners = '';
				var partnersList = this.byId("counterparty").getTokens();
				for(var i = 0; i < partnersList.length; i++){
					oData.Partners = oData.Partners + partnersList[i].getKey() + ";";
				}
				if(oData.Partners){
					oData.Partners = oData.Partners.slice(0, -1);
				}
				oData.CompanyCode = offerData.CompanyBranch;
				oData.PaymentMethod = offerData.PaymentMethod;
				oData.PaymentTerm = offerData.PaymentTerm;
				var DateFrom = null;
				var DateTo = null;
				var oneDay = 24*60*60*1000;
				var Tonnage = 0;
				for(var i = 0; i < volumeData.data.ToOfferVolume.length; i++){
					for(var j = 0; j < volumeData.data.ToOfferVolume[i].ToOfferPeriod.length; j++){
						var period = volumeData.data.ToOfferVolume[i].ToOfferPeriod[j];
						if(DateFrom){
							DateFrom = period.DateFrom < DateFrom ? period.DateFrom : DateFrom;
						}else{
							DateFrom = period.DateFrom;
						}
						if(DateTo){
							DateTo = period.DateTo > DateTo ? period.DateTo : DateTo;
						}else{
							DateTo = period.DateTo;
						}
						Tonnage = Tonnage + parseInt(period.TonnageMax);
					}
				}
				var Period = Math.round(Math.abs((DateFrom - DateTo)/(oneDay)));
				oData.Period = Period;
				oData.Tonnage = Tonnage;
				oData.TCNumber = this.byId("TCNumber").getValue();
				return oData;
			},
			
			checkLimits: function(){
				var oFuncParams = this.collectLimitsData();
				this.getModel().callFunction("/CheckValidityLimits", {
					method: "GET",
					urlParameters: oFuncParams,
					success: this.onCheckLimitsSuccess.bind(this, "CheckValidityLimits")
				});
			},
			onCheckLimitsSuccess: function(link, oData) {
				var oResult = oData[link];
				this.byId("limitPaymentConditionIcon").setColor(oResult.PaymentExceed ? "red" : "green").setSrc(oResult.PaymentExceed ? 'sap-icon://alert' : 'sap-icon://accept');
				this.byId("limitPeriodIcon").setColor(oResult.PeriodExceed ? "red" : "green").setSrc(oResult.PeriodExceed ? 'sap-icon://alert' : 'sap-icon://accept');
				this.byId("limitTonnageIcon").setColor(oResult.TonnageExceed ? "red" : "green").setSrc(oResult.TonnageExceed ? 'sap-icon://alert' : 'sap-icon://accept');
				this.byId("limitPaymentCondition").setText(oResult.PaymentCondition);
				this.byId("limitPeriod").setText(oResult.Period + " " + oResult.PeriodUoM);
				this.byId("limitTonnage").setText(oResult.Tonnage + " " + oResult.TonnageUoM);
			}
		});
	}
);