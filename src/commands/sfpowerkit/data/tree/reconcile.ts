import { core, SfdxCommand, FlagsConfig, flags } from "@salesforce/command";
import { fs as SfdxUtil } from "@salesforce/core";

var path = require("path");
var fs = require("fs");

import RecordTypeRetriever from "../../../../impl/metadata/retriever/recordTypeRetriever";
import _ from "lodash";

// Initialize Messages with the current plugin directory
core.Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = core.Messages.loadMessages(
  "sfpowerkit",
  "data_tree_reconcile"
);

export default class Reconcile extends SfdxCommand {
  public static description = messages.getMessage("commandDescription");

  public static examples = [
    `$ sfdx sfpowerkit:data:tree:reconcile --sample SampleFolderName --output OutputFolderName
  `
  ];

  //public static args = [{ name: 'file' }];

  protected static flagsConfig: FlagsConfig = {
    sample: flags.string({
      char: "s",
      description: messages.getMessage("sampleFolderDescription"),
      required: true
    }),
    output: flags.string({
      char: "d",
      description: messages.getMessage("outputFolderDescription"),
      required: true
    })
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  //protected static supportsDevhubUsername = true;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  //protected static requiresProject = false;

  public async run(): Promise<any> {
    // tslint:disable-line:no-any
    var me = this;
    const recordTypeUtils = RecordTypeRetriever.getInstance(this.org);
    const recordTypes = await recordTypeUtils.getObjects();

    const sampleFolder: string = this.flags.sample;
    const outputFolder: string = this.flags.output;

    /* PATH TO SAMPLE FOLDER */
    var sampleFolderPath = path.join(process.cwd(), sampleFolder);

    this.GenerateRecordTypes(sampleFolderPath, outputFolder, me, recordTypes);
  }

  /* FUNCTION TO GET RECORD TYPE ID GIVEN DEVELOPER NAME AND SOBJECTTYPE */
  public getRecordTypeIdByDeveloperName(
    SobjectType,
    developerName,
    recordTypes: any[]
  ) {
    if (recordTypes === null || recordTypes === undefined) {
      recordTypes = [];
    }
    for (var i = 0; i < recordTypes.length; i++) {
      if (
        recordTypes[i].DeveloperName == developerName &&
        recordTypes[i].SobjectType == SobjectType
      ) {
        return recordTypes[i].Id;
      }
    }
    return "";
  }

  /* FUNCTION TO TRAVERSE DIRECTORY, CREATE SUBFOLDERS AND GENERATE NEW FILES */
  public GenerateRecordTypes(directory, outputFolder, me, recordTypes) {
    var files = fs.readdirSync(directory);

    if (fs.existsSync(outputFolder) == false) {
      fs.mkdirSync(outputFolder);
    }
    files.forEach(file => {
      var filepath = path.join(directory, file);
      var outputPath = path.join(outputFolder, file);

      if (fs.lstatSync(filepath).isDirectory() == true) {
        this.GenerateRecordTypes(filepath, outputPath, me, recordTypes);
      } else {
        var contents = fs.readFileSync(filepath);
        var obj = JSON.parse(contents);

        if (!_.isNil(obj.records)) {
          obj.records.forEach(element => {
            var recordTypeDeveloperName = "";

            if (_.isNil(element.RecordTypeId)) {
              var recordTypeObj = element.RecordType;
              if (!_.isNil(recordTypeObj)) {
                recordTypeDeveloperName = recordTypeObj.DeveloperName;
                delete element.RecordType;
              }
            } else {
              recordTypeDeveloperName = element.RecordTypeId;
            }
            if (
              !_.isNil(recordTypeDeveloperName) &&
              recordTypeDeveloperName !== ""
            ) {
              var recordTypeId = me.getRecordTypeIdByDeveloperName(
                element.attributes.type,
                recordTypeDeveloperName,
                recordTypes
              );
              element.RecordTypeId = recordTypeId;
            } else {
              delete element.RecordTypeId;
            }
          });
        }

        var newFilePath = path.join(process.cwd(), outputPath);
        SfdxUtil.writeJson(newFilePath, obj);
      }
    });
  }
}
