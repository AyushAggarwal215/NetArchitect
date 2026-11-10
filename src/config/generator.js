/**
 * src/config/generator.js
 * Cisco IOS Configuration Generator for NetArchitect (CIC-307).
 *
 * Generates security-hardened, production-style Cisco IOS device configurations
 * derived strictly from calculated VLSM allocations, media topologies, and routing designs.
 *
 * Zero third-party template engine dependencies (pure ES6 modular template renderer).
 */

import { DeviceConfig, Decision } from "../core/models.js";
import {
  NATIVE_VLAN_ID,
  STP_ROOT_PRIORITY,
  OSPF_PROCESS_ID,
  ONPREM_ASN,
  CLOUD_ASN,
  IPSEC_PRESHARED_KEY_PLACEHOLDER,
  QOS_VOICE_PRIORITY_PERCENT
} from "../core/constants.js";
import {
  prefixToMaskBigInt,
  maskToWildcardBigInt,
  bigIntToIp
} from "../utils/ip-address.js";

/**
 * Builds DeviceConfig objects for every device in the network scenario.
 *
 * @param {import('../core/models.js').Scenario} scenario
 * @param {import('../core/models.js').SubnetAllocation[]} allocations
 * @param {import('../core/models.js').MediaSelection[]} mediaResults
 * @param {import('../core/models.js').RoutingConfig} routingConfig
 * @returns {DeviceConfig[]}
 */
export function buildDeviceConfigs(scenario, allocations, mediaResults, routingConfig) {
  const deviceConfigs = [];
  const allDevices = [];

  for (const site of scenario.sites) {
    for (const dev of site.devices) {
      allDevices.push({ site, dev });
    }
  }

  // The very first device in the first site is the primary Core/Root switch
  const rootBridgeDeviceName = allDevices.length > 0 ? allDevices[0].dev.name : "";

  // Group VLANs by site
  const siteVlanMap = new Map();
  for (const vlan of scenario.vlans) {
    if (!siteVlanMap.has(vlan.site)) {
      siteVlanMap.set(vlan.site, []);
    }
    siteVlanMap.get(vlan.site).push(vlan);
  }

  // Restricted vs Protected VLAN classification for ACLs (Campus profile)
  const restrictedVlanNames = new Set(["Students", "Labs"]);
  const protectedVlanNames = new Set(["Servers", "Mgmt", "Management"]);

  for (const { site, dev } of allDevices) {
    const isL3 = dev.type === "l3_switch" || dev.type === "router";
    const isRoot = dev.name === rootBridgeDeviceName;

    const dc = new DeviceConfig({
      hostname: dev.name,
      deviceType: dev.type,
      supportsIsl: dev.supportsIsl,
      siteName: site.name,
      ipRouting: isL3,
      nativeVlan: NATIVE_VLAN_ID,
      stpMode: "rapid-pvst",
      stpIsRoot: isRoot,
      stpRootPriority: STP_ROOT_PRIORITY
    });

    const localVlans = siteVlanMap.get(site.name) || [];
    dc.vlans = localVlans.map(v => ({ id: v.id, name: v.name }));

    // Find non-PTP, non-loopback allocations for this site
    const siteAllocs = allocations.filter(
      a => a.site === site.name && !a.isPtp && !a.isLoopback
    );

    // In Metro profile, Routers use Dot1Q subinterfaces on their physical routed ports
    // for EVPL handoff rather than switch SVIs to prevent duplicate IP collisions.
    const useSubinterfaces = (scenario.profile === "metro" && dev.type === "router");

    // Build SVIs (for L3 Switches or routers not using EVPL subinterfaces)
    if (!useSubinterfaces) {
      for (const vlan of localVlans) {
        const alloc = siteAllocs.find(a => a.name === vlan.name);
        if (alloc) {
          dc.svis.push({
            vlanId: vlan.id,
            ip: alloc.gateway,
            mask: alloc.mask,
            name: vlan.name,
            network: alloc.network,
            wildcard: alloc.wildcard
          });
        }
      }
    }

    // Build Trunk and Routed PTP Links
    const vlanIdList = localVlans.map(v => v.id).join(",");
    let portIndex = 1;

    for (const link of scenario.links) {
      if (link.a === site.name || link.b === site.name) {
        const otherEnd = link.a === site.name ? link.b : link.a;

        // Check if there is a point-to-point subnet allocated for this link
        const ptpAlloc = allocations.find(
          a => a.isPtp && (
            a.name === `P2P-${link.a}-${link.b}` ||
            a.name === `P2P-${link.b}-${link.a}`
          )
        );

        if (ptpAlloc && isL3) {
          // Routed PTP port
          const isASide = (link.a === site.name);
          const portIp = isASide ? ptpAlloc.gateway : ptpAlloc.lastUsable;
          dc.routedPorts.push({
            interface: `GigabitEthernet0/${portIndex}`,
            ip: portIp,
            mask: ptpAlloc.mask,
            description: `P2P to ${otherEnd}`,
            network: ptpAlloc.network,
            wildcard: ptpAlloc.wildcard
          });
        } else if (vlanIdList) {
          // 802.1Q Layer 2 Trunk port
          dc.trunkPorts.push({
            interface: `GigabitEthernet0/${portIndex}`,
            allowedVlans: vlanIdList,
            nativeVlan: NATIVE_VLAN_ID,
            needsEncap: dev.supportsIsl, // only emit 'switchport trunk encapsulation dot1q' if device supports ISL
            description: `Trunk to ${otherEnd}`
          });
        }
        portIndex++;
      }
    }

    // Build Subinterfaces (Metro EVPL handoff on Routers)
    if (useSubinterfaces && dc.routedPorts.length > 0) {
      for (const vlan of localVlans) {
        const alloc = siteAllocs.find(a => a.name === vlan.name);
        if (alloc) {
          const baseIface = dc.routedPorts[0].interface;
          dc.subinterfaces.push({
            interface: `${baseIface}.${vlan.id}`,
            encapsulation: `dot1Q ${vlan.id}`,
            ip: alloc.gateway,
            mask: alloc.mask,
            description: `EVPL ${vlan.name}`,
            network: alloc.network,
            wildcard: alloc.wildcard
          });
        }
      }
    }

    // Build Access Ports (PortFast + BPDU Guard + optional PoE)
    for (const vlan of localVlans) {
      const portNum = (vlan.id % 48) + 1;
      dc.accessPorts.push({
        interface: `GigabitEthernet1/0/${portNum}`,
        vlan: vlan.id,
        description: `${vlan.name} access`,
        poe: Boolean(vlan.poe)
      });
    }

    // Build Loopback0 (Router-ID)
    const loAlloc = allocations.find(a => a.isLoopback && a.name === `Lo0-${dev.name}`);
    if (loAlloc) {
      dc.loopbacks.push({
        interface: "Loopback0",
        ip: loAlloc.gateway,
        mask: loAlloc.mask,
        description: `Router-ID ${dev.name}`
      });
    }

    // Build OSPF configuration
    const area = routingConfig.ospfAreas[site.name] !== undefined
      ? routingConfig.ospfAreas[site.name]
      : 0;
    const ospfNetworks = [];

    // Add SVI networks to OSPF
    for (const svi of dc.svis) {
      ospfNetworks.push({
        network: svi.network,
        wildcard: svi.wildcard,
        area
      });
    }

    // Add subinterface networks to OSPF
    for (const sub of dc.subinterfaces) {
      ospfNetworks.push({
        network: sub.network,
        wildcard: sub.wildcard,
        area
      });
    }

    // Add routed ports to OSPF (PTP links between sites are in Area 0 in multi-area ABR design)
    for (const rp of dc.routedPorts) {
      ospfNetworks.push({
        network: rp.network,
        wildcard: rp.wildcard,
        area: routingConfig.isMultiArea ? 0 : area
      });
    }

    // Add loopback to OSPF
    for (const lo of dc.loopbacks) {
      ospfNetworks.push({
        network: lo.ip,
        wildcard: "0.0.0.0",
        area
      });
    }

    // Passive interfaces: All client-facing SVIs and EVPL subinterfaces
    const passiveInterfaces = [
      ...dc.svis.map(svi => `Vlan${svi.vlanId}`),
      ...dc.subinterfaces.map(sub => sub.interface)
    ];

    // Area range route summarization for ABR in Area 0
    const areaRangesList = [];
    if (routingConfig.isMultiArea && area === 0 && routingConfig.areaRanges) {
      for (const [arArea, arPrefix] of Object.entries(routingConfig.areaRanges)) {
        if (Number(arArea) !== 0) {
          const [ipStr, plenStr] = arPrefix.split("/");
          const plen = Number(plenStr);
          const mask = bigIntToIp(prefixToMaskBigInt(plen));
          areaRangesList.push({
            area: Number(arArea),
            network: ipStr,
            mask
          });
        }
      }
    }

    const routerId = loAlloc
      ? loAlloc.gateway
      : (dc.svis.length > 0 ? dc.svis[0].ip : (dc.subinterfaces.length > 0 ? dc.subinterfaces[0].ip : "1.1.1.1"));

    dc.ospf = {
      processId: OSPF_PROCESS_ID,
      routerId,
      networks: ospfNetworks,
      passiveInterfaces,
      areaRanges: areaRangesList
    };

    // Build Extended ACLs (Campus profile security policy)
    if (scenario.profile === "campus") {
      const protectedSubnets = allocations.filter(a => protectedVlanNames.has(a.name));
      for (const vlan of localVlans) {
        if (restrictedVlanNames.has(vlan.name)) {
          const aclName = `RESTRICT-${vlan.name.toUpperCase()}`;
          const entries = [];
          for (const ps of protectedSubnets) {
            entries.push(`remark Deny ${vlan.name} access to ${ps.name} subnet`);
            entries.push(`deny ip any ${ps.network} ${ps.wildcard}`);
          }
          entries.push("remark Permit all other outbound intranet and internet traffic");
          entries.push("permit ip any any");

          dc.acls.push({
            name: aclName,
            entries
          });
          dc.aclApplications.push({
            interface: `Vlan${vlan.id}`,
            aclName,
            direction: "in"
          });
        }
      }
    }

    // Build BGP configuration (WAN Profile)
    if (routingConfig.hasBgp && site.name === scenario.sites[0].name) {
      const rootParts = scenario.rootPrefix.split("/");
      const rootPlen = Number(rootParts[1]);
      const rootMaskStr = bigIntToIp(prefixToMaskBigInt(rootPlen));

      dc.bgp = {
        localAs: routingConfig.bgpLocalAs || ONPREM_ASN,
        neighbors: [
          {
            ip: routingConfig.bgpPeerIp || "10.200.0.1",
            remoteAs: routingConfig.bgpCloudAs || CLOUD_ASN
          }
        ],
        networks: [
          {
            network: rootParts[0],
            mask: rootMaskStr
          }
        ]
      };
    }

    // Build IPsec VPN configuration (WAN Profile on Hub site)
    if (scenario.profile === "wan" && routingConfig.hasBgp && site.name === scenario.sites[0].name) {
      const cloudPrefix = scenario.cloud?.prefix || (scenario.extras && scenario.extras.cloud_prefix);
      if (cloudPrefix) {
        const [cloudIp, cloudPlenStr] = cloudPrefix.split("/");
        const cloudPlen = Number(cloudPlenStr);
        const cloudWildcard = bigIntToIp(maskToWildcardBigInt(prefixToMaskBigInt(cloudPlen)));

        const [rootIp, rootPlenStr] = scenario.rootPrefix.split("/");
        const rootPlen = Number(rootPlenStr);
        const rootWildcard = bigIntToIp(maskToWildcardBigInt(prefixToMaskBigInt(rootPlen)));

        dc.ipsec = {
          presharedKey: IPSEC_PRESHARED_KEY_PLACEHOLDER,
          peerIp: routingConfig.bgpPeerIp || "10.200.0.1",
          aclName: "IPSEC-INTERESTING",
          localNetwork: rootIp,
          localWildcard: rootWildcard,
          remoteNetwork: cloudIp,
          remoteWildcard: cloudWildcard,
          mapName: "IPSEC-MAP",
          interface: dc.routedPorts.length > 0 ? dc.routedPorts[0].interface : "GigabitEthernet0/1"
        };
      }
    }

    // Build QoS (Metro Profile)
    if (scenario.profile === "metro") {
      if (dc.routedPorts.length > 0) {
        dc.qos = {
          priorityPercent: QOS_VOICE_PRIORITY_PERCENT,
          interface: dc.routedPorts[0].interface
        };
      }
    }

    deviceConfigs.push(dc);
  }

  return deviceConfigs;
}

/**
 * Pure ES6 template renderer for a DeviceConfig object into Cisco IOS syntax.
 * @param {DeviceConfig} dc
 * @returns {string}
 */
export function renderDeviceConfig(dc) {
  const lines = [];

  lines.push(`! ===== DEVICE: ${dc.hostname} =====`);
  lines.push("!");
  lines.push(`hostname ${dc.hostname}`);
  lines.push("no ip domain-lookup");
  lines.push("!");

  // Layer 2 VLANs
  if (dc.vlans && dc.vlans.length > 0) {
    lines.push("! --- VLAN Configuration (IEEE 802.1Q) ---");
    for (const v of dc.vlans) {
      lines.push(`vlan ${v.id}`);
      lines.push(` name ${v.name}`);
    }
    lines.push(`vlan ${dc.nativeVlan}`);
    lines.push(" name NATIVE");
    lines.push("!");
  }

  // Spanning Tree
  if (dc.vlans && dc.vlans.length > 0) {
    lines.push("! --- Spanning Tree (IEEE 802.1w RSTP) ---");
    lines.push(`spanning-tree mode ${dc.stpMode}`);
    if (dc.stpIsRoot) {
      for (const v of dc.vlans) {
        lines.push(`spanning-tree vlan ${v.id} priority ${dc.stpRootPriority}`);
      }
    }
    lines.push("!");
  }

  // Layer 3 Routing flag
  if (dc.ipRouting) {
    lines.push("! --- Layer 3 Routing ---");
    lines.push("ip routing");
    lines.push("!");
  }

  // SVI Interfaces
  if (dc.svis && dc.svis.length > 0) {
    lines.push("! --- SVI Interfaces ---");
    for (const svi of dc.svis) {
      lines.push(`interface Vlan${svi.vlanId}`);
      lines.push(` description ${svi.name} SVI`);
      lines.push(` ip address ${svi.ip} ${svi.mask}`);
      lines.push(" no shutdown");
      lines.push("!");
    }
  }

  // Trunk Ports
  if (dc.trunkPorts && dc.trunkPorts.length > 0) {
    lines.push("! --- Trunk Ports ---");
    for (const port of dc.trunkPorts) {
      lines.push(`interface ${port.interface}`);
      lines.push(` description ${port.description}`);
      if (port.needsEncap) {
        lines.push(" switchport trunk encapsulation dot1q");
      }
      lines.push(" switchport mode trunk");
      lines.push(` switchport trunk allowed vlan ${port.allowedVlans}`);
      lines.push(` switchport trunk native vlan ${port.nativeVlan}`);
      lines.push(" no shutdown");
      lines.push("!");
    }
  }

  // Access Ports
  if (dc.accessPorts && dc.accessPorts.length > 0) {
    lines.push("! --- Access Ports ---");
    for (const port of dc.accessPorts) {
      lines.push(`interface ${port.interface}`);
      lines.push(` description ${port.description}`);
      lines.push(" switchport mode access");
      lines.push(` switchport access vlan ${port.vlan}`);
      lines.push(" spanning-tree portfast");
      lines.push(" spanning-tree bpduguard enable");
      if (port.poe) {
        lines.push(" power inline auto");
      }
      lines.push(" no shutdown");
      lines.push("!");
    }
  }

  // Routed Ports
  if (dc.routedPorts && dc.routedPorts.length > 0) {
    lines.push("! --- Routed Point-to-Point Ports ---");
    for (const port of dc.routedPorts) {
      lines.push(`interface ${port.interface}`);
      lines.push(` description ${port.description}`);
      lines.push(" no switchport");
      lines.push(` ip address ${port.ip} ${port.mask}`);
      lines.push(" no shutdown");
      lines.push("!");
    }
  }

  // Loopbacks
  if (dc.loopbacks && dc.loopbacks.length > 0) {
    lines.push("! --- Loopback Interfaces ---");
    for (const lo of dc.loopbacks) {
      lines.push(`interface ${lo.interface}`);
      lines.push(` description ${lo.description}`);
      lines.push(` ip address ${lo.ip} ${lo.mask}`);
      lines.push(" no shutdown");
      lines.push("!");
    }
  }

  // Subinterfaces (Metro EVPL handoff)
  if (dc.subinterfaces && dc.subinterfaces.length > 0) {
    lines.push("! --- Dot1Q Subinterfaces (Metro EVPL handoff) ---");
    for (const sub of dc.subinterfaces) {
      lines.push(`interface ${sub.interface}`);
      lines.push(` description ${sub.description}`);
      lines.push(` encapsulation ${sub.encapsulation}`);
      lines.push(` ip address ${sub.ip} ${sub.mask}`);
      lines.push(" no shutdown");
      lines.push("!");
    }
  }

  // OSPF
  if (dc.ospf) {
    lines.push("! --- OSPF Configuration (RFC 2328) ---");
    lines.push(`router ospf ${dc.ospf.processId}`);
    lines.push(` router-id ${dc.ospf.routerId}`);
    for (const net of dc.ospf.networks) {
      lines.push(` network ${net.network} ${net.wildcard} area ${net.area}`);
    }
    for (const pi of dc.ospf.passiveInterfaces) {
      lines.push(` passive-interface ${pi}`);
    }
    for (const ar of dc.ospf.areaRanges) {
      lines.push(` area ${ar.area} range ${ar.network} ${ar.mask}`);
    }
    lines.push("!");
  }

  // Extended ACLs
  if (dc.acls && dc.acls.length > 0) {
    lines.push("! --- Access Control Lists ---");
    for (const acl of dc.acls) {
      lines.push(`ip access-list extended ${acl.name}`);
      for (const entry of acl.entries) {
        lines.push(` ${entry}`);
      }
      lines.push("!");
    }
    for (const app of dc.aclApplications) {
      lines.push(`interface ${app.interface}`);
      lines.push(` ip access-group ${app.aclName} ${app.direction}`);
      lines.push("!");
    }
  }

  // BGP
  if (dc.bgp) {
    lines.push("! --- BGP Configuration (RFC 4271, RFC 6996) ---");
    lines.push(`router bgp ${dc.bgp.localAs}`);
    for (const n of dc.bgp.neighbors) {
      lines.push(` neighbor ${n.ip} remote-as ${n.remoteAs}`);
    }
    for (const net of dc.bgp.networks) {
      lines.push(` network ${net.network} mask ${net.mask}`);
    }
    lines.push("!");
  }

  // IPsec VPN
  if (dc.ipsec) {
    lines.push("! --- IPsec VPN Configuration (RFC 4301) ---");
    lines.push("crypto isakmp policy 10");
    lines.push(" encr aes 256");
    lines.push(" authentication pre-share");
    lines.push(" group 14");
    lines.push("!");
    lines.push(`crypto isakmp key ${dc.ipsec.presharedKey} address ${dc.ipsec.peerIp}`);
    lines.push("!");
    lines.push("crypto ipsec transform-set IPSEC-TS esp-aes 256 esp-sha256-hmac");
    lines.push(" mode tunnel");
    lines.push("!");
    lines.push(`ip access-list extended ${dc.ipsec.aclName}`);
    lines.push(" remark Interesting traffic for IPsec tunnel");
    lines.push(` permit ip ${dc.ipsec.localNetwork} ${dc.ipsec.localWildcard} ${dc.ipsec.remoteNetwork} ${dc.ipsec.remoteWildcard}`);
    lines.push("!");
    lines.push(`crypto map ${dc.ipsec.mapName} 10 ipsec-isakmp`);
    lines.push(` set peer ${dc.ipsec.peerIp}`);
    lines.push(" set transform-set IPSEC-TS");
    lines.push(` match address ${dc.ipsec.aclName}`);
    lines.push("!");
    lines.push(`interface ${dc.ipsec.interface}`);
    lines.push(` crypto map ${dc.ipsec.mapName}`);
    lines.push("!");
  }

  // QoS
  if (dc.qos) {
    lines.push("! --- QoS Configuration (Metro) ---");
    lines.push("class-map match-all VOICE-CLASS");
    lines.push(" match dscp ef");
    lines.push("!");
    lines.push("policy-map QOS-POLICY");
    lines.push(" class VOICE-CLASS");
    lines.push(`  priority percent ${dc.qos.priorityPercent}`);
    lines.push("!");
    lines.push(`interface ${dc.qos.interface}`);
    lines.push(" service-policy output QOS-POLICY");
    lines.push("!");
  }

  lines.push("end");
  return lines.join("\n");
}

/**
 * Generate configuration text for all devices in a scenario.
 *
 * @param {import('../core/models.js').Scenario} scenario
 * @param {import('../core/models.js').SubnetAllocation[]} allocations
 * @param {import('../core/models.js').MediaSelection[]} mediaResults
 * @param {import('../core/models.js').RoutingConfig} routingConfig
 * @returns {{ configs: Record<string, string>, decisions: Decision[] }}
 */
export function generateAllConfigs(scenario, allocations, mediaResults, routingConfig) {
  const decisions = [];
  const deviceConfigs = buildDeviceConfigs(scenario, allocations, mediaResults, routingConfig);
  const configs = {};

  for (const dc of deviceConfigs) {
    const configText = renderDeviceConfig(dc);
    configs[dc.hostname] = configText;

    decisions.push(new Decision({
      ruleId: `CONFIG-${dc.hostname}`,
      domain: "security",
      subject: `Device ${dc.hostname}`,
      choice: `Generated Cisco IOS Configuration (${configText.split("\n").length} lines)`,
      reason: `Assembled configuration for ${dc.hostname} (${dc.deviceType}) at site ${dc.siteName}. ` +
        `Enforced: ${dc.svis.length} SVIs, ${dc.trunkPorts.length} trunks with explicit VLAN lists and Native VLAN 999, ` +
        `${dc.accessPorts.length} access ports with BPDU Guard, ${dc.routedPorts.length} routed PTP ports, ` +
        `${dc.ospf ? "OSPF with passive interfaces on access SVIs" : "no dynamic routing"}` +
        `${dc.bgp ? ", eBGP peering" : ""}${dc.ipsec ? ", AES-256 IPsec tunnel" : ""}` +
        `${dc.qos ? ", DSCP EF QoS priority queuing" : ""}.`,
      references: ["IEEE 802.1Q", "IEEE 802.1w", "RFC 2328"]
    }));
  }

  return { configs, decisions };
}
