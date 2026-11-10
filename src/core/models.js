/**
 * src/core/models.js
 * Strongly typed data structures and factory models for NetArchitect.
 */

export class Decision {
  /**
   * @param {Object} params
   * @param {string} params.ruleId - e.g. "MEDIA-001", "VLSM-002", "ROUTE-001"
   * @param {string} params.domain - 'media' | 'vlsm' | 'routing' | 'security' | 'qos'
   * @param {string} params.subject - The entity or link being decided
   * @param {string} params.choice - Selected engineering option
   * @param {string} params.reason - Detailed justification with numerical values
   * @param {string[]} [params.references] - Governing IEEE / RFC standards
   * @param {string} [params.alternative] - Feasible alternative considered
   * @param {string} [params.rejectionReason] - Why alternative was not chosen
   */
  constructor({
    ruleId,
    domain,
    subject,
    choice,
    reason,
    references = [],
    alternative = null,
    rejectionReason = null
  }) {
    this.ruleId = ruleId;
    this.domain = domain;
    this.subject = subject;
    this.choice = choice;
    this.reason = reason;
    this.references = references;
    this.alternative = alternative;
    this.rejectionReason = rejectionReason;
  }
}

export class Device {
  /**
   * @param {Object} params
   * @param {string} params.name
   * @param {'l3_switch'|'router'|'access_switch'} params.type
   * @param {boolean} [params.supportsIsl]
   */
  constructor({ name, type = "l3_switch", supportsIsl = false }) {
    this.name = name;
    this.type = type;
    this.supportsIsl = Boolean(supportsIsl);
  }
}

export class Site {
  /**
   * @param {Object} params
   * @param {string} params.name
   * @param {Device[]} [params.devices]
   * @param {number|null} [params.area]
   */
  constructor({ name, devices = [], area = null }) {
    this.name = name;
    this.devices = devices.map(d => (d instanceof Device ? d : new Device(d)));
    this.area = area !== undefined && area !== null ? Number(area) : null;
  }
}

export class Link {
  /**
   * @param {Object} params
   * @param {string} params.a - Site or Device A
   * @param {string} params.b - Site or Device B
   * @param {number} params.distanceM - Distance in metres
   * @param {'copper'|'fiber'|null} [params.mediaRequest]
   */
  constructor({ a, b, distanceM, mediaRequest = null }) {
    this.a = a;
    this.b = b;
    this.distanceM = Number(distanceM);
    this.mediaRequest = mediaRequest;
  }
}

export class Vlan {
  /**
   * @param {Object} params
   * @param {number} params.id
   * @param {string} params.name
   * @param {number} params.hosts
   * @param {string} params.site
   * @param {boolean} [params.poe]
   */
  constructor({ id, name, hosts, site, poe = false }) {
    this.id = Number(id);
    this.name = name;
    this.hosts = Number(hosts);
    this.site = site;
    this.poe = Boolean(poe);
  }
}

export class Scenario {
  /**
   * @param {Object} params
   * @param {'campus'|'metro'|'wan'|string} params.profile
   * @param {string} params.rootPrefix - e.g. "10.10.0.0/16"
   * @param {Site[]} params.sites
   * @param {Link[]} params.links
   * @param {Vlan[]} params.vlans
   * @param {boolean} [params.resiliency]
   * @param {Object|null} [params.cloud]
   * @param {Object} [params.extras]
   */
  constructor({
    profile,
    rootPrefix,
    sites = [],
    links = [],
    vlans = [],
    resiliency = false,
    cloud = null,
    extras = {}
  }) {
    this.profile = profile;
    this.rootPrefix = rootPrefix;
    this.sites = sites.map(s => (s instanceof Site ? s : new Site(s)));
    this.links = links.map(l => (l instanceof Link ? l : new Link(l)));
    this.vlans = vlans.map(v => (v instanceof Vlan ? v : new Vlan(v)));
    this.resiliency = Boolean(resiliency);
    this.cloud = cloud || extras?.cloud || null;
    this.extras = extras || {};
  }
}

export class MediaSelection {
  /**
   * @param {Object} params
   */
  constructor({
    linkA,
    linkB,
    distanceM,
    mediaType,
    standard,
    transceiver = null,
    wavelengthNm = null,
    budgetDb = null,
    lossDb = null,
    marginDb = null,
    propagationDelayUs = 0.0,
    wanCircuit = false
  }) {
    this.linkA = linkA;
    this.linkB = linkB;
    this.distanceM = Number(distanceM);
    this.mediaType = mediaType;
    this.standard = standard;
    this.transceiver = transceiver;
    this.wavelengthNm = wavelengthNm;
    this.budgetDb = budgetDb;
    this.lossDb = lossDb;
    this.marginDb = marginDb;
    this.propagationDelayUs = propagationDelayUs;
    this.wanCircuit = Boolean(wanCircuit);
  }
}

export class SubnetAllocation {
  /**
   * @param {Object} params
   */
  constructor({
    name,
    site,
    hostsRequested,
    network,
    prefixLen,
    mask,
    wildcard,
    broadcast,
    gateway,
    firstUsable,
    lastUsable,
    usableCount,
    utilization,
    isPtp = false,
    isLoopback = false,
    aggregatePrefix = null
  }) {
    this.name = name;
    this.site = site;
    this.hostsRequested = Number(hostsRequested);
    this.network = network;
    this.prefixLen = Number(prefixLen);
    this.mask = mask;
    this.wildcard = wildcard;
    this.broadcast = broadcast;
    this.gateway = gateway;
    this.firstUsable = firstUsable;
    this.lastUsable = lastUsable;
    this.usableCount = Number(usableCount);
    this.utilization = Number(utilization);
    this.isPtp = Boolean(isPtp);
    this.isLoopback = Boolean(isLoopback);
    this.aggregatePrefix = aggregatePrefix;
  }
}

export class RoutingConfig {
  /**
   * @param {Object} params
   */
  constructor({
    protocol = "ospf",
    ospfAreas = {},
    isMultiArea = false,
    hasBgp = false,
    bgpLocalAs = 0,
    bgpCloudAs = 0,
    bgpPeerIp = "",
    areaRanges = {}
  }) {
    this.protocol = protocol;
    this.ospfAreas = ospfAreas;
    this.isMultiArea = Boolean(isMultiArea);
    this.hasBgp = Boolean(hasBgp);
    this.bgpLocalAs = Number(bgpLocalAs);
    this.bgpCloudAs = Number(bgpCloudAs);
    this.bgpPeerIp = bgpPeerIp;
    this.areaRanges = areaRanges;
  }
}

export class DeviceConfig {
  /**
   * @param {Object} params
   */
  constructor({
    hostname,
    deviceType,
    supportsIsl = false,
    siteName = "",
    ipRouting = false,
    vlans = [],
    nativeVlan = 999,
    stpMode = "rapid-pvst",
    stpIsRoot = false,
    stpRootPriority = 4096,
    svis = [],
    trunkPorts = [],
    accessPorts = [],
    routedPorts = [],
    loopbacks = [],
    subinterfaces = [],
    ospf = null,
    bgp = null,
    acls = [],
    aclApplications = [],
    ipsec = null,
    qos = null
  }) {
    this.hostname = hostname;
    this.deviceType = deviceType;
    this.supportsIsl = Boolean(supportsIsl);
    this.siteName = siteName;
    this.ipRouting = Boolean(ipRouting);
    this.vlans = vlans;
    this.nativeVlan = nativeVlan;
    this.stpMode = stpMode;
    this.stpIsRoot = Boolean(stpIsRoot);
    this.stpRootPriority = stpRootPriority;
    this.svis = svis;
    this.trunkPorts = trunkPorts;
    this.accessPorts = accessPorts;
    this.routedPorts = routedPorts;
    this.loopbacks = loopbacks;
    this.subinterfaces = subinterfaces;
    this.ospf = ospf;
    this.bgp = bgp;
    this.acls = acls;
    this.aclApplications = aclApplications;
    this.ipsec = ipsec;
    this.qos = qos;
  }
}

