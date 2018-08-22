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
				var fragmentsArr = [ "counterpartyPopupDialog", "portPopupDialog", "currencyPopupDialog", "volumeUomPopupDialog", "volumes", "periodsPrices" ];
				this.addFragments(fragmentsArr);
				
				this.getRouter().getRoute("worklist").attachPatternMatched(this._onOfferMatched, this);
			},
			
			_onOfferMatched: function(oEvent) {
				this.TCNumber = oEvent.getParameter("arguments").TCNumber;
				this.Type = oEvent.getParameter("arguments").Type;
				this.getModel().metadataLoaded().then( function() {
					if(this.Type){
						this.byId("offerTitle").setText(this.getResourceBundle().getText("editOffer2"));
						this.byId("navCon").to(this.byId("p4"));
					}
					if(this.TCNumber){
						this.getView().bindElement({ path: "/offerHeaderSet('" + this.TCNumber + "')" });
						this.byId("offerTitle").setText(this.getResourceBundle().getText("editOffer", [this.TCNumber]));
						this.byId("approveOffer").setEnabled(true);
						this.byId("uploadVbox").setVisible(true);
					}else{
						this.byId("creationDate").setDateValue(new Date());
						this.byId("trader").setValue(sap.ushell.Container.getService("UserInfo").getUser().getId());
						this.byId("createdBy").setValue(sap.ushell.Container.getService("UserInfo").getUser().getId());
					}
				}.bind(this));
			},
			
			saveOffer: function(oEvent){
				var button = oEvent.getSource();
				var objectsArr = button.data("blocks").split(',');
				var offerData = this.getOdata(objectsArr);
				var volumeData = this.getVolumeOdata();
				var model = button.getModel();
				var allData = this.mergeObjects(offerData,volumeData);
				var uploader = this.byId("upload");
				var settings = {};
				var msg = '';
				var alertSettings = {
					actions: [sap.m.MessageBox.Action.CLOSE]
				};
				if(allData.TCNumber === "$$00000001"){
					msg = "Offer successfully created";
					alertSettings.onClose = function(sAction) {
						this.getRouter().navTo("worklist", {
							TCNumber: response.TCNumber
						});
					};
				}else{
					msg = "Offer saved";
				}
				console.log(allData);
				settings.success = function(response){
					MessageBox.alert(msg, alertSettings);
					if(uploader.getValue()){
						var uploadUrl = model.sServiceUrl + "/offerHeaderSet('" + response.TCNumber + "')/ToAttachment";
						uploader.setUploadUrl(uploadUrl);
						uploader.upload();
					}
				};
				model.create("/offerHeaderSet", allData, settings);
			},
			
			approveOffer: function(oEvent){
				
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
					var operator = FilterOperator.Contains;
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
					template: table['mBindingInfos'].items.template
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
					var objects = ["blacklistCounterparty","blacklistStatus","blacklistCountry"];
					for(var i = 0; i < objects.length; i++){
						this.byId(objects[i]).removeAllItems();
					}
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
						valueHelp.addToken(token);
						this.byId("counterpartyOne").setValue(data.Code);
					}else{
						valueHelp.setValue(data[key]);
					}
					if(id === "counterpartyPopup"){
						this.setBlacklist(data, objects);
					}
				}
				this[id + "Dialog"].close();
			},
			
			// Sets the texts to show counterparty blacklist
			setBlacklist: function(data, objects){
				var blacklisted = data.BlackList;
				var status = blacklisted ? this.getModel('i18n').getResourceBundle().getText("blacklisted") : 
					this.getModel('i18n').getResourceBundle().getText("notBlacklisted");
					
				var counterpartyText = new sap.m.CustomListItem({
					content: new sap.m.Text({ text: data.Name })
				});
				var statusText = new sap.m.CustomListItem({
					content: new sap.m.Text({ text: status })
				});
				var countryText = new sap.m.CustomListItem({
					content: new sap.m.Text({ text: data.Country })
				});
				var texts = [counterpartyText,statusText,countryText];
				for(var i = 0; i < texts.length; i++){
					texts[i].getContent()[0].addStyleClass("smallMarginBottom");
					if(blacklisted){
						texts[i].getContent()[0].addStyleClass("red");
					}
				}
				this.byId(objects[0]).addItem(counterpartyText);
				this.byId(objects[1]).addItem(statusText);
				if(data.Country){
					this.byId(objects[2]).addItem(countryText);
				}
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
						MessageBox.alert(msg, {
							actions: [sap.m.MessageBox.Action.CLOSE]
						});
						return true;
					}
				}
				if(next){
					if(next === "p1"){
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
			
			// Set key inputs as disabled/enabled for editting
			// Arguments: dialog = object dialog, flag = boolean flag for enabled/disabled
			// all = boolean set all inputs
			setEnabledDialog: function(dialog, flag, all){
				var inputs = dialog.getContent();
				for(var i = 0; i < inputs.length; i++){
					for(var j = 0; j < this.typeArr.length; j++){
						var type = this.typeArr[j];
						var input = inputs[i];
						if(input["mBindingInfos"].hasOwnProperty(type)){
							if(all){
								input.setEnabled(flag);
							}else{ 
								if(input.data("key")){
									input.setEnabled(false);
								}else{
									input.setEnabled(flag);
								}
							}
						}
					}
				}
			},
		
			// Checks the key inputs for empty values for dialog Add/Edit
			checkKeys: function(object){
				var check = "";
				var inputs = this.getInputs(object);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input.data("key")){
						if((input["mProperties"].hasOwnProperty("value") && !input.getValue()) || 
						(input["mProperties"].hasOwnProperty("selectedKey") && !input.getSelectedKey()) ||
						(input.hasOwnProperty("_tokenizer") && input.getTokens().length === 0) ||
						(input.hasOwnProperty("_oMaxDate") && !input.getDateValue())){
							check = check + " " + this.getModel('i18n').getResourceBundle().getText(input.data("key")) + ", ";
						}
					}
				}
				return check;
			},
		
			// Set odata from any dialog, argument object = any object / return object inputs Data
			getOdata: function(object){
				var oData = {};
				var inputs = this.getInputs(object);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input["sId"].indexOf('hbox') > -1){
						var vboxes = input.getItems();
						for(var j = 0; j < vboxes.length; j++){
							oData = this.mergeObjects(oData, this.getInputData(vboxes[j].getItems()[1]));
						}
					}else{
						oData = this.mergeObjects(oData, this.getInputData(input));
					}
				}
				return oData;
			},
			
			getInputData: function(input){
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
							value = input.getProperty(type)
						}
						var name = input.getBindingInfo(type).binding.sPath;
						
						// Set default value(placeholder) if value is not defined
						if(!value && input["mProperties"].hasOwnProperty("placeholder")){
							value = input["mProperties"].placeholder;
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
			
			openMail: function(oEvent){
				var counterParty = oEvent.getSource().data("key");
				window.open("mailto:");
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
				Switch.getParent().getParent().getItems()[1].setVisible(state);
				if(type && type === "volumes"){
					var title = Switch.getParent().getParent().getParent().getHeaderToolbar().getContent()[0];
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
			
			copyFrom: function(){
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
			
			getVolumeOdata: function(){
				var oData = {};
				var list = this.byId("volumesList");
				var volumes = list.getItems();
				oData.ToOfferVolume = [];
				for(var i = 0; i < volumes.length; i++){
					var volumeName = this.getOdata(volumes[i].getContent()[0].getHeaderToolbar());
					var volumeData = this.getOdata(volumes[i].getContent()[0]);
					var allVolumeData = this.mergeObjects(volumeName, volumeData);
					oData.ToOfferVolume.push(allVolumeData);
					
					var periodsList = volumes[i].getContent()[0].getContent()[1];
					var periods = periodsList.getItems();
					
					allVolumeData.ToOfferPeriodAndPrice = [];
					
					for(var j = 0; j < periods.length; j++){
						var period = periods[j].getContent()[0].getContent()[0];
						var periodOdata = this.getOdata(period);
						allVolumeData.ToOfferPeriodAndPrice.push(periodOdata);
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
					date2 = dp2.getDateValue() ? dp2.getDateValue().toLocaleDateString() : '';
					title.setText(date2 + " - " + date);
				}
				
			},
			
			setOfferType: function(oEvent){
				this.byId('volumesList').removeAllItems();
				if(oEvent.getParameter("selectedItem").getKey() === "OF01"){
					this.byId('volumeAddButton').firePress();
					this.setInput(["volumeAddButton", "volumeDeleteButton", "volumeCopyButton"], false, "Visible");
				}else{
					this.setInput(["volumeAddButton", "volumeDeleteButton", "volumeCopyButton"], true, "Visible");
				}
			},
			
			// On select item in Attachments table
			onAttachmentSelect: function(e){
				var listItems = e.getParameters("listItem");
				if (listItems) {
					var id = e.getSource().data("id");
					this.setInput([id + "Delete", id + "Download"], true, "Enabled");
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
			}
		});
	}
);