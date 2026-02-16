import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import GATv2Conv
from torchvision import models

class EfficientNetGAT(nn.Module):
    def __init__(self, num_classes=5, gat_hidden_dim=256, num_heads=4):
        super(EfficientNetGAT, self).__init__()
        
        # EfficientNetV2-S as feature extractor
        self.efficientnet = models.efficientnet_v2_s(pretrained=True)
        
        # Remove classification head
        self.efficientnet.classifier = nn.Identity()
        
        # Get feature dimensions by running a forward pass
        with torch.no_grad():
            dummy_input = torch.zeros(1, 3, 224, 224)
            features = self.efficientnet(dummy_input)
            self.feature_dim = features.shape[1]  # Should be 1280 for EfficientNetV2-S
        
        # For graph structure
        self.num_nodes = 49  # 7x7 grid
        self.node_feat_dim = self.feature_dim // self.num_nodes  # Split features among nodes
        
        # Feature transformation to get proper node features
        self.transform = nn.Linear(self.feature_dim, self.num_nodes * self.node_feat_dim)
        
        # GATv2 layers
        self.gat1 = GATv2Conv(
            in_channels=self.node_feat_dim,
            out_channels=gat_hidden_dim // num_heads,
            heads=num_heads,
            concat=True,
            dropout=0.2
        )
        
        self.gat2 = GATv2Conv(
            in_channels=gat_hidden_dim,
            out_channels=gat_hidden_dim,
            heads=1,
            concat=False,
            dropout=0.2
        )
        
        # Final classifier
        self.fc = nn.Linear(self.node_feat_dim + gat_hidden_dim, num_classes)
        
        # Fixed edge index for grid
        self.edge_index = self._create_grid_edges(7, 7)
        
    def _create_grid_edges(self, height, width):
        edge_index = []
        for i in range(height):
            for j in range(width):
                node = i * width + j
                # 8-neighbor connectivity
                for di in [-1, 0, 1]:
                    for dj in [-1, 0, 1]:
                        if di == 0 and dj == 0:
                            continue
                        ni, nj = i + di, j + dj
                        if 0 <= ni < height and 0 <= nj < width:
                            neighbor = ni * width + nj
                            edge_index.append([node, neighbor])
        
        return torch.tensor(edge_index, dtype=torch.long).t().contiguous()
    
    def forward(self, x):
        batch_size = x.size(0)
        
        # Extract features using EfficientNet
        cnn_features = self.efficientnet(x)  # Should be [batch_size, 1280]
        
        # Transform to get proper node features
        transformed = self.transform(cnn_features)  # [batch_size, num_nodes * node_feat_dim]
        node_features = transformed.view(batch_size, self.num_nodes, self.node_feat_dim)  # [batch_size, 49, node_feat_dim]
        
        # Process each image in batch separately with GAT
        graph_embeddings = []
        for i in range(batch_size):
            # GAT processing
            x_gat = self.gat1(node_features[i], self.edge_index.to(x.device))
            x_gat = F.elu(x_gat)
            x_gat = F.dropout(x_gat, p=0.2, training=self.training)
            x_gat = self.gat2(x_gat, self.edge_index.to(x.device))
            graph_embeddings.append(x_gat)
        
        graph_embeddings = torch.stack(graph_embeddings)  # [batch_size, 49, gat_hidden_dim]
        
        # Combine features
        combined = torch.cat([node_features, graph_embeddings], dim=-1)  # [batch_size, 49, node_feat_dim+gat_hidden_dim]
        
        # Global average pooling
        pooled = combined.mean(dim=1)  # [batch_size, node_feat_dim+gat_hidden_dim]
        
        # Final classification
        out = self.fc(pooled)
        
        return out