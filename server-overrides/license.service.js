"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var LicenseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseService = void 0;
const common_1 = require("@nestjs/common");
const features_1 = require("../../common/features");
const workspace_repo_1 = require("../../database/repos/workspace/workspace.repo");

let LicenseService = LicenseService_1 = class LicenseService {
    constructor(workspaceRepo) {
        this.workspaceRepo = workspaceRepo;
        this.logger = new common_1.Logger(LicenseService_1.name);
    }
    async activateLicense(licenseKey, workspaceId) {
        return this.formatLicense({});
    }
    async removeLicense(workspaceId) {
    }
    isValidEELicense(licenseKey) {
        return true;
    }
    hasFeature(licenseKey, feature) {
        return true;
    }
    getFeatures(licenseKey) {
        return Object.values(features_1.Feature);
    }
    getLicenseType(licenseKey) {
        return "enterprise";
    }
    async getLicenseInfo(licenseKey) {
        return this.formatLicense({});
    }
    verifyLicense(licenseKey) {
        return {
            licenseId: "mcl-enterprise-license",
            customer: { name: "HQL Global" },
            seats: 9999,
            licenseType: "enterprise",
            issuedAt: new Date().toISOString(),
            expiresAt: "2099-12-31T23:59:59.999Z",
            trial: false,
        };
    }
    isLicenseExpired(license) {
        return false;
    }
    formatLicense(license) {
        return {
            id: "mcl-enterprise-license",
            customerName: "HQL Global",
            seatCount: 9999,
            licenseType: "enterprise",
            issuedAt: new Date().toISOString(),
            expiresAt: "2099-12-31T23:59:59.999Z",
            trial: false,
        };
    }
};
exports.LicenseService = LicenseService;
exports.LicenseService = LicenseService = LicenseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [workspace_repo_1.WorkspaceRepo])
], LicenseService);
